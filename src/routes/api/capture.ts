import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { verifyVerdict, canonicalise, type Verdict } from "@/lib/api/check-signature";
import { createLimiter, clientIp } from "@/lib/api/rate-limit";
import { renderVerdictEmail, sendEmail } from "@/lib/api/email";
import { FAILURE_REASONS, type FailureReason } from "@/lib/api/readability";
import { APP_ORIGIN } from "@/config/product";

/**
 * Capture: the visitor asks for the read they just saw.
 *
 * This replaces a browser-side insert straight into the waitlist table. That insert worked,
 * because anon held INSERT and the policy was WITH CHECK (true), which is also why anyone
 * could script unlimited rows at PostgREST with no rate limit, no validation and no size cap,
 * while /api/check next door was carefully guarded. The table is now unreachable from a
 * browser and this is the only way in.
 *
 * Three things happen here, in an order chosen so a failure late does not lose work done
 * early: the verdict is recorded, the person is recorded against it, and then the email goes
 * out. A mail provider having a bad minute therefore costs the send, not the capture, and the
 * response says which of those happened rather than claiming both.
 *
 * The verdict is not taken on trust. It arrives from the browser, so without a signature this
 * endpoint would write whatever a caller's HTTP client chose to send, including a fabricated
 * "blocked" against a competitor's domain. That is the same failure refusalConfirmed prevents
 * one layer down in classify(), and it gets the same answer: the record holds only verdicts
 * this service issued.
 */

/** Five a minute per address. Lower than the checker: nobody captures in a loop. */
const limiter = createLimiter(5, 60_000);

/** Bounds the parse. A capture body is a few hundred bytes; this is generous. */
const MAX_BODY_BYTES = 8_000;

const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum for a forward path.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Deliberately permissive: one @, something either side, a dot in the domain, no whitespace.
 *
 * Validating email harder than this rejects real addresses, and the address is proven by
 * whether the send lands rather than by how well it matches a pattern. The length cap matters
 * more than the shape, because that is the part that bounds what gets stored.
 */
function validEmail(s: string): boolean {
  return s.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(s);
}

/** Narrow the untrusted body into the exact verdict shape, or refuse it. */
function parseVerdict(v: unknown): Verdict | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;

  if (typeof o.host !== "string" || !o.host) return null;
  if (typeof o.readable !== "boolean") return null;
  if (typeof o.method !== "string") return null;
  if (typeof o.detail !== "string") return null;
  if (typeof o.checked_at !== "string") return null;

  // The closed set is enforced here as well as by the check constraint in the database. A
  // reason outside it would be rejected by Postgres anyway, but as a 500 rather than as the
  // 400 it actually is.
  let reason: FailureReason | null = null;
  if (o.reason !== null && o.reason !== undefined) {
    if (typeof o.reason !== "string") return null;
    if (!(FAILURE_REASONS as readonly string[]).includes(o.reason)) return null;
    reason = o.reason as FailureReason;
  }

  // The same invariant the table holds: a readable page carries no reason, an unreadable one
  // carries exactly one. Checked before the signature so a malformed body is a 400 rather
  // than looking like a forgery.
  if (o.readable !== (reason === null)) return null;

  const httpStatus =
    o.http_status === null || o.http_status === undefined
      ? null
      : typeof o.http_status === "number" && Number.isInteger(o.http_status)
        ? o.http_status
        : undefined;
  if (httpStatus === undefined) return null;

  return {
    host: o.host,
    readable: o.readable,
    reason,
    method: o.method,
    detail: o.detail,
    http_status: httpStatus,
    checked_at: o.checked_at,
  };
}

export const Route = createFileRoute("/api/capture")({
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

        let payload: { email?: unknown; verdict?: unknown; signature?: unknown };
        try {
          payload = JSON.parse(raw);
        } catch {
          return json({ error: "bad_request", message: "Send JSON." }, 400);
        }

        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
        if (!validEmail(email)) {
          return json(
            { error: "bad_email", message: "That email address does not look right." },
            422,
          );
        }

        const verdict = parseVerdict(payload.verdict);
        if (!verdict) {
          return json({ error: "bad_verdict", message: "That result could not be read." }, 400);
        }

        // Fails closed. Without the secret no verdict can be proven ours, and an unprovable
        // verdict does not enter the record. The checker itself keeps working without it, so
        // a misconfigured deploy loses the follow-up rather than the front page.
        const secret = process.env.CHECK_SIGNING_SECRET;
        const signature = typeof payload.signature === "string" ? payload.signature : null;
        if (!secret || !verifyVerdict(verdict, signature, secret)) {
          return json(
            {
              error: "unverified_verdict",
              message: "That result could not be verified. Run the check again.",
            },
            400,
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // The same bytes the signature covered, so the stored hash identifies exactly what
        // was signed. Re-submitting a verdict already recorded is a no-op, enforced by the
        // unique index on (host, envelope_hash) rather than by a read-then-write race.
        const envelopeHash = createHash("sha256").update(canonicalise(verdict)).digest("hex");

        const { data: check, error: checkError } = await supabaseAdmin
          .from("domain_checks")
          .upsert(
            {
              host: verdict.host,
              checked_at: verdict.checked_at,
              readable: verdict.readable,
              failure_reason: verdict.reason,
              method: verdict.method,
              detail: verdict.detail,
              http_status: verdict.http_status ?? null,
              envelope_hash: envelopeHash,
            },
            { onConflict: "host,envelope_hash" },
          )
          .select("id")
          .single();

        if (checkError || !check) {
          console.error("[capture] domain_checks write failed", checkError);
          return json(
            { error: "storage_failed", message: "We could not record that. Try again shortly." },
            500,
          );
        }

        // Upsert on email: someone checking a second domain is the same person with a newer
        // interest, not a duplicate to reject. Only the columns named here are written, so an
        // admin's status decision on an existing row survives.
        const { error: waitlistError } = await supabaseAdmin.from("waitlist").upsert(
          {
            email,
            company: verdict.host,
            use_case: "domain check",
            source: "checker",
            check_id: check.id,
          },
          { onConflict: "email" },
        );

        if (waitlistError) {
          console.error("[capture] waitlist write failed", waitlistError);
          return json(
            { error: "storage_failed", message: "We could not record that. Try again shortly." },
            500,
          );
        }

        // The send is last and its failure is reported, not thrown. The capture already
        // succeeded by this point, and telling the visitor to submit again would produce a
        // second row and no second email.
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM ?? "Legibility <hello@legibility.io>";
        let emailed = false;
        if (apiKey) {
          const result = await sendEmail(email, renderVerdictEmail(verdict, APP_ORIGIN), {
            apiKey,
            from,
          });
          emailed = result.sent;
          if (!result.sent) console.error("[capture] send failed", result.error);
        }

        return json({ ok: true, emailed });
      },
    },
  },
});
