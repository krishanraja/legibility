// Signs the verdict /api/check issues, so /api/capture can prove it issued it.
//
// The checker is unauthenticated and returns a verdict about a named third party. Capture
// then stores that verdict against an email address. Without a signature the stored row is
// whatever the caller's HTTP client chose to send, which means anyone could script a false
// "blocked" against a competitor's domain into the record.
//
// That is the exact failure refusalConfirmed exists to prevent in classify(), one layer
// down: an index that publishes an accusation it cannot stand behind is finished the first
// time it is wrong in public. So the record only ever holds verdicts this service produced.
//
// Hand-rolled HMAC deciding what enters the record, so it is tested directly. It mirrors
// the shape of stripe-signature.ts deliberately: one signed payload, a timestamp inside the
// signed material, a bounded window, and a timing-safe compare.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FailureReason } from "./readability";

/**
 * How long a signed verdict stays redeemable.
 *
 * Bounded by how long a person plausibly takes to read a result and decide to hand over an
 * email, not by how long the verdict stays true. Thirty minutes is generous for that and
 * still short enough that a captured signature is not a durable forgery tool.
 */
export const VERDICT_WINDOW_SECONDS = 1800;

/** The verdict as issued. Exactly the fields /api/check returns, and nothing derived. */
export type Verdict = {
  host: string;
  readable: boolean;
  reason: FailureReason | null;
  method: string;
  detail: string;
  http_status?: number | null;
  checked_at: string;
};

/**
 * Canonical signed material.
 *
 * Built field by field in a fixed order rather than with JSON.stringify, because key order
 * there follows insertion order: a verdict rebuilt with its keys in a different sequence
 * would serialise differently and fail to verify for a reason that looks like tampering.
 * Every field is included, so changing any of them invalidates the signature. Nulls and
 * undefined collapse to the empty string so the two cannot be played off against each
 * other, and the separator is a character that cannot appear in a hostname or a reason.
 */
export function canonicalise(v: Verdict): string {
  return [
    v.host,
    v.readable ? "1" : "0",
    v.reason ?? "",
    v.method,
    v.detail,
    v.http_status == null ? "" : String(v.http_status),
    v.checked_at,
  ].join("\n");
}

/** Sign a verdict. The result travels beside it in the response body. */
export function signVerdict(v: Verdict, secret: string): string {
  return createHmac("sha256", secret).update(canonicalise(v)).digest("hex");
}

/**
 * Verify a verdict against its signature.
 *
 * Fails closed on every uncertain path: no signature, an unparseable checked_at, a verdict
 * outside the window, or any mismatch. There is no branch here that lets an unverified
 * verdict through, because the only caller uses the answer to decide what enters the record.
 *
 * @param nowMs injectable clock, so window behaviour is testable without faking time
 */
export function verifyVerdict(
  v: Verdict,
  signature: string | null | undefined,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  if (!signature) return false;

  const issued = Date.parse(v.checked_at);
  if (!Number.isFinite(issued)) return false;

  // Absolute value, so a checked_at in the future is rejected too. A verdict dated forward
  // would otherwise stay redeemable for as long as its author cared to postdate it.
  if (Math.abs(nowMs - issued) > VERDICT_WINDOW_SECONDS * 1000) return false;

  const expected = signVerdict(v, secret);
  try {
    // timingSafeEqual throws when the buffers differ in length, which is itself a mismatch.
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
