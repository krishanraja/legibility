import { createFileRoute } from "@tanstack/react-router";
import { classify, normaliseDomainInput, isAllowedByRobots } from "@/lib/api/readability";

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

const USER_AGENT = "LegibilityBot/0.1 (+https://legibility.io/about/bot)";
const TIMEOUT_MS = 12_000;

/** Bounds the work one request can cause: two fetches, both short, both size-limited. */
const MAX_BYTES = 2_000_000;

/**
 * Per-IP rate limit, in memory.
 *
 * Deliberately not a fifth piece of infrastructure. This runs per serverless instance, so
 * it is a floor rather than a guarantee: it stops one browser hammering the endpoint,
 * which is the realistic abuse here. A determined distributed caller is bounded instead by
 * the timeouts and byte cap above, which is why those exist rather than being left to
 * defaults.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Unbounded growth would be a slow leak on a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
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
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          request.headers.get("x-real-ip") ??
          "unknown";

        if (rateLimited(ip, Date.now())) {
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
          return json({
            host: target.host,
            readable: false,
            reason: "robots_disallowed",
            method: "none",
            detail: "robots.txt asks machines not to read this page. We did not fetch it.",
            checked_at: new Date().toISOString(),
          });
        }

        try {
          const res = await get(target.url);
          // No second-opinion path is available inside a serverless function, so a single
          // 403 is reported as inconclusive rather than as a block. The cohort sweep, which
          // can cross-check, is the thing allowed to call a site blocked.
          const verdict = classify(res.status, res.body, false);
          return json({
            host: target.host,
            readable: verdict.readable,
            reason: verdict.reason,
            method: verdict.method,
            detail: verdict.detail,
            http_status: res.status,
            checked_at: new Date().toISOString(),
          });
        } catch (e) {
          const timedOut = e instanceof Error && /abort/i.test(e.name + e.message);
          return json({
            host: target.host,
            readable: false,
            reason: timedOut ? "timeout" : "error",
            method: "none",
            detail: timedOut
              ? "The site did not answer within 12 seconds."
              : "We could not reach the site.",
            checked_at: new Date().toISOString(),
          });
        }
      },
    },
  },
});
