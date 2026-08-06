// Stripe webhook signature verification, extracted from the route so it can be tested
// directly. Importing the route file would pull in createFileRoute and the whole router.
//
// This is hand-rolled crypto that decides whether a payment event is authentic, so it is
// the highest-value test target in the repository. See src/lib/api/stripe-signature.test.ts.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Stripe rejects events older than this many seconds (replay protection). */
export const REPLAY_WINDOW_SECONDS = 300;

/**
 * Verify a Stripe `stripe-signature` header against the raw request body.
 *
 * Header shape: `t=<unix_seconds>,v1=<hex_hmac>[,v0=...]`
 * The signed payload is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret.
 *
 * @param nowMs injectable clock, so replay-window behaviour is testable without faking time
 */
export function verifySignature(
  payload: string,
  header: string | null,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  if (!header) return false;

  // A malformed pair like "v1" with no "=" yields [key, undefined]; the t/v1 guard below
  // catches that. Object.fromEntries on an empty header gives {}, also caught.
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;

  // Absolute value, so a timestamp far in the future is rejected too, not just an old one.
  const age = Math.abs(Math.floor(nowMs / 1000) - ts);
  if (age > REPLAY_WINDOW_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    // timingSafeEqual throws when the buffers differ in length, which is itself a mismatch.
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

const SUB_STATUS = new Set(["trialing", "active", "past_due", "canceled", "incomplete"]);

/** Map a Stripe subscription status onto the set the `subscriptions` table accepts. */
export function mapStatus(s: string): string {
  if (SUB_STATUS.has(s)) return s;
  if (s === "unpaid") return "past_due";
  return "canceled";
}
