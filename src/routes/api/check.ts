import { createFileRoute } from "@tanstack/react-router";
import { classify, normaliseDomainInput, isAllowedByRobots } from "@/lib/api/readability";
import { signVerdict, type Verdict as SignedVerdict } from "@/lib/api/check-signature";
import { createLimiter, clientIp } from "@/lib/api/rate-limit";
import { BOT_UA } from "@/config/product";

/**
 * Public domain checker. The front page's primary action points here.
 *
 * This is unauthenticated on purpose: the conversion mechanism is "enter your domain and
 * see what a machine sees", and putting a signup in front of that turns a verdict back
 * into a promise. That makes it a public endpoint which fetches a URL on the caller's
 * behalf, so the guards below are not decoration.
 *
 * It answers honestly in both directions. A domain that reads perfectly is told so
 * plainly. Manufacturing alarm here would be caught within minutes by anyone who checks a
 * site they know, and being citable is worth more than a scary result.
 */

// Declared identity, from src/config/product.ts. The +url in it must resolve, and does.
const USER_AGENT = BOT_UA;
const TIMEOUT_MS = 12_000;

/** Bounds the work one request can cause: two fetches, both short, both size-limited. */
const MAX_BYTES = 2_000_000;

/** Ten checks a minute per address. Shared implementation, see lib/api/rate-limit.ts. */
const limiter = createLimiter(10, 60_000);

/**
 * Sign the verdict so /api/capture can prove this service issued it.
 *
 * An absent secret means unsigned, and the verdict still goes out: the free checker is what
 * every visitor sees and it keeps working. Only capture, which writes to the record, refuses
 * an unsigned verdict. A misconfigured deploy therefore degrades to "the tool works, the
 * follow-up does not" rather than taking the front page down.
 */
function sign(v: SignedVerdict): string | undefined {
  const secret = process.env.CHECK_SIGNING_SECRET;
  return secret ? signVerdict(v, secret) : undefined;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function get(url: string): Promise<{ status: number; body: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ac.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
    // Read with a cap rather than res.text(): a hostile or merely enormous response should
    // not be able to exhaust the function's memory.
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, body: "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      chunks.push(value);
      if (total >= MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    return { status: res.status, body: new TextDecoder().decode(Buffer.concat(chunks)) };
  } finally {
    clearTimeout(t);
  }
}

export const Route = createFileRoute("/api/check")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (limiter.limited(clientIp(request))) {
          return json(
            { error: "rate_limited", message: "Too many checks. Try again shortly." },
            429,
          );
        }

        let payload: { domain?: unknown };
        try {
          payload = await request.json();
        } catch {
          return json({ error: "bad_request", message: "Send JSON." }, 400);
        }
        if (typeof payload.domain !== "string") {
          return json({ error: "bad_request", message: "Enter a domain." }, 400);
        }

        const target = normaliseDomainInput(payload.domain);
        if ("error" in target) return json({ error: "bad_domain", message: target.error }, 422);

        // Robots first, always, and the result is reported rather than worked around.
        let robotsAllowed = true;
        try {
          const r = await get(`https://${target.host}/robots.txt`);
          if (r.status === 200) robotsAllowed = isAllowedByRobots(r.body, "/", USER_AGENT);
        } catch {
          robotsAllowed = true; // unreachable robots.txt means permitted, per the standard
        }

        if (!robotsAllowed) {
          const verdict: SignedVerdict = {
            host: target.host,
            readable: false,
            reason: "robots_disallowed",
            method: "none",
            detail: "robots.txt asks machines not to read this page. We did not fetch it.",
            checked_at: new Date().toISOString(),
          };
          return json({ ...verdict, signature: sign(verdict) });
        }

        try {
          const res = await get(target.url);
          // No second-opinion path is available inside a serverless function, so a single
          // 403 is reported as inconclusive rather than as a block. The cohort sweep, which
          // can cross-check, is the thing allowed to call a site blocked.
          const classified = classify(res.status, res.body, false);
          const verdict: SignedVerdict = {
            host: target.host,
            readable: classified.readable,
            reason: classified.reason,
            method: classified.method,
            detail: classified.detail,
            http_status: res.status,
            checked_at: new Date().toISOString(),
          };
          return json({ ...verdict, signature: sign(verdict) });
        } catch (e) {
          const timedOut = e instanceof Error && /abort/i.test(e.name + e.message);
          const verdict: SignedVerdict = {
            host: target.host,
            readable: false,
            reason: timedOut ? "timeout" : "error",
            method: "none",
            detail: timedOut
              ? "The site did not answer within 12 seconds."
              : "We could not reach the site.",
            checked_at: new Date().toISOString(),
          };
          return json({ ...verdict, signature: sign(verdict) });
        }
      },
    },
  },
});
