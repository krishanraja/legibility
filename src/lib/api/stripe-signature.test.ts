import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mapStatus, REPLAY_WINDOW_SECONDS, verifySignature } from "./stripe-signature";

// Deliberately does NOT look like a Stripe key. An earlier version of this fixture used a
// realistic "whsec_" prefix with hex, and gitleaks correctly flagged it as a generic-api-key.
// HMAC works with any string, so the realism bought nothing and cost a false positive.
const SECRET = "test-signing-value-not-a-credential";
const BODY = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
const NOW_MS = 1_770_000_000_000; // fixed clock, injected; no fake timers needed
const NOW_S = Math.floor(NOW_MS / 1000);

/** Build a genuine Stripe-format signature header for a given timestamp. */
function sign(payload: string, ts: number, secret = SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}

describe("verifySignature", () => {
  it("accepts a correctly signed current payload", () => {
    expect(verifySignature(BODY, sign(BODY, NOW_S), SECRET, NOW_MS)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(verifySignature(BODY, null, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(verifySignature(BODY, "", SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a header with no v1 component", () => {
    expect(verifySignature(BODY, `t=${NOW_S}`, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a header with no t component", () => {
    const v1 = createHmac("sha256", SECRET).update(`${NOW_S}.${BODY}`).digest("hex");
    expect(verifySignature(BODY, `v1=${v1}`, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a malformed header with no key=value pairs", () => {
    expect(verifySignature(BODY, "not-a-signature", SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    const v1 = createHmac("sha256", SECRET).update(`abc.${BODY}`).digest("hex");
    expect(verifySignature(BODY, `t=abc,v1=${v1}`, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const forged = sign(BODY, NOW_S, "a-different-signing-value");
    expect(verifySignature(BODY, forged, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const header = sign(BODY, NOW_S);
    const tampered = JSON.stringify({ id: "evt_1", type: "invoice.paid", amount: 999999 });
    expect(verifySignature(tampered, header, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a v1 of the wrong length (timingSafeEqual throws, must not leak)", () => {
    expect(verifySignature(BODY, `t=${NOW_S},v1=deadbeef`, SECRET, NOW_MS)).toBe(false);
  });

  it("accepts a payload signed at the exact edge of the replay window", () => {
    const ts = NOW_S - REPLAY_WINDOW_SECONDS;
    expect(verifySignature(BODY, sign(BODY, ts), SECRET, NOW_MS)).toBe(true);
  });

  it("rejects a payload one second beyond the replay window", () => {
    const ts = NOW_S - REPLAY_WINDOW_SECONDS - 1;
    expect(verifySignature(BODY, sign(BODY, ts), SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a timestamp far in the future, not just an old one", () => {
    const ts = NOW_S + REPLAY_WINDOW_SECONDS + 1;
    expect(verifySignature(BODY, sign(BODY, ts), SECRET, NOW_MS)).toBe(false);
  });

  it("verifies an empty body, which Stripe can send", () => {
    expect(verifySignature("", sign("", NOW_S), SECRET, NOW_MS)).toBe(true);
  });

  it("ignores extra components such as the legacy v0 scheme", () => {
    const header = `${sign(BODY, NOW_S)},v0=ignored`;
    expect(verifySignature(BODY, header, SECRET, NOW_MS)).toBe(true);
  });
});

describe("mapStatus", () => {
  it.each(["trialing", "active", "past_due", "canceled", "incomplete"])(
    "passes through the known status %s",
    (s) => {
      expect(mapStatus(s)).toBe(s);
    },
  );

  it("maps unpaid onto past_due rather than dropping the customer", () => {
    expect(mapStatus("unpaid")).toBe("past_due");
  });

  it.each(["incomplete_expired", "paused", "", "something_new_from_stripe"])(
    "falls back to canceled for the unrecognised status %s",
    (s) => {
      expect(mapStatus(s)).toBe("canceled");
    },
  );
});
