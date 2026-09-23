import { createFileRoute } from "@tanstack/react-router";
import { createLimiter, clientIp } from "@/lib/api/rate-limit";

/**
 * Takedown requests, moved off the browser-side insert.
 *
 * The form used to write straight into takedown_requests from the page, which worked because
 * anon held INSERT under WITH CHECK (true). That is the same open door the waitlist had: no
 * rate limit, no validation, no size cap, reachable directly at PostgREST by anyone who read
 * the bundle. The grant is revoked, so this route is now the only way in.
 *
 * The product's answer to a takedown is published in the FAQ as "we honour it within 24
 * hours". The write is therefore the deliverable and its failure is reported rather than
 * swallowed, unlike a metering row where best effort is the right call.
 */

/** Three a minute per address. A person files one; a script files thousands. */
const limiter = createLimiter(3, 60_000);

const MAX_BODY_BYTES = 8_000;
const MAX_EMAIL_LENGTH = 254;
const MAX_URL_LENGTH = 2_048;
const MAX_REASON_LENGTH = 4_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function validEmail(s: string): boolean {
  return s.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(s);
}

export const Route = createFileRoute("/api/takedown")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (limiter.limited(clientIp(request))) {
          return json(
            { error: "rate_limited", message: "Too many requests. Try again shortly." },
            429,
          );
        }

        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return json({ error: "bad_request", message: "That request was too large." }, 413);
        }

        let payload: { email?: unknown; url?: unknown; reason?: unknown };
        try {
          payload = JSON.parse(raw);
        } catch {
          return json({ error: "bad_request", message: "Send JSON." }, 400);
        }

        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
        const url = typeof payload.url === "string" ? payload.url.trim() : "";
        const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

        if (!validEmail(email)) {
          return json(
            { error: "bad_email", message: "That email address does not look right." },
            422,
          );
        }
        if (!url || url.length > MAX_URL_LENGTH) {
          return json({ error: "bad_url", message: "Enter the URL to remove." }, 422);
        }
        if (!reason || reason.length > MAX_REASON_LENGTH) {
          return json({ error: "bad_reason", message: "Tell us why, briefly." }, 422);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("takedown_requests")
          .insert({ email, url, reason });

        if (error) {
          console.error("[takedown] write failed", error);
          return json(
            { error: "storage_failed", message: "We could not file that. Try again shortly." },
            500,
          );
        }

        return json({ ok: true });
      },
    },
  },
});
