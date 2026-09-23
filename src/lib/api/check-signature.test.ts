import { describe, expect, it } from "vitest";
import {
  canonicalise,
  signVerdict,
  verifyVerdict,
  VERDICT_WINDOW_SECONDS,
  type Verdict,
} from "./check-signature";

/**
 * This signature decides what enters the record. Without it /api/capture would store any
 * verdict a caller cared to send, including a fabricated "blocked" against a third party's
 * domain, which is precisely the false accusation classify()'s refusalConfirmed path exists
 * to prevent one layer down.
 *
 * So the properties under test are: every field is covered by the signature, the window is
 * enforced in both directions, and every uncertain path fails closed.
 */

const SECRET = "test-secret";
const NOW = Date.parse("2026-09-23T12:00:00.000Z");

const VERDICT: Verdict = {
  host: "example.com",
  readable: false,
  reason: "js_shell",
  method: "none",
  detail: "40000B of HTML, only 120B of readable text",
  http_status: 200,
  checked_at: "2026-09-23T12:00:00.000Z",
};

function signed(v: Verdict = VERDICT) {
  return signVerdict(v, SECRET);
}

describe("canonicalise", () => {
  it("includes every field, so changing any one changes the signed material", () => {
    const base = canonicalise(VERDICT);
    const mutations: Partial<Verdict>[] = [
      { host: "other.com" },
      { readable: true, reason: null },
      { reason: "blocked" },
      { method: "jsonld" },
      { detail: "something else" },
      { http_status: 403 },
      { checked_at: "2026-09-23T12:00:01.000Z" },
    ];
    for (const m of mutations) {
      expect(canonicalise({ ...VERDICT, ...m })).not.toBe(base);
    }
  });

  it("does not depend on key order", () => {
    // Rebuilt with the keys in reverse insertion order. JSON.stringify would differ here,
    // which is the reason this function exists rather than being a stringify call.
    const reordered: Verdict = {
      checked_at: VERDICT.checked_at,
      http_status: VERDICT.http_status,
      detail: VERDICT.detail,
      method: VERDICT.method,
      reason: VERDICT.reason,
      readable: VERDICT.readable,
      host: VERDICT.host,
    };
    expect(canonicalise(reordered)).toBe(canonicalise(VERDICT));
  });

  it("collapses a null http_status and an absent one to the same material", () => {
    const withNull: Verdict = { ...VERDICT, http_status: null };
    const without: Verdict = { ...VERDICT };
    delete without.http_status;
    expect(canonicalise(withNull)).toBe(canonicalise(without));
  });

  it("does not let a null reason be confused with the empty string", () => {
    // A readable verdict has reason null. The separator is a newline, which cannot appear in
    // a host or a reason, so the fields cannot be slid into one another.
    const readable: Verdict = { ...VERDICT, readable: true, reason: null };
    expect(canonicalise(readable).split("\n")).toHaveLength(7);
  });
});

describe("verifyVerdict", () => {
  it("accepts a verdict signed with the same secret", () => {
    expect(verifyVerdict(VERDICT, signed(), SECRET, NOW)).toBe(true);
  });

  it("rejects a missing signature", () => {
    expect(verifyVerdict(VERDICT, null, SECRET, NOW)).toBe(false);
    expect(verifyVerdict(VERDICT, undefined, SECRET, NOW)).toBe(false);
    expect(verifyVerdict(VERDICT, "", SECRET, NOW)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyVerdict(VERDICT, signVerdict(VERDICT, "other"), SECRET, NOW)).toBe(false);
  });

  it("rejects every single-field tamper", () => {
    const sig = signed();
    const tampers: Partial<Verdict>[] = [
      { host: "victim.com" },
      { readable: true, reason: null },
      { reason: "blocked" },
      { method: "jsonld" },
      { detail: "rewritten evidence" },
      { http_status: 403 },
    ];
    for (const t of tampers) {
      expect(verifyVerdict({ ...VERDICT, ...t }, sig, SECRET, NOW)).toBe(false);
    }
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on a length mismatch. That is itself a mismatch, not a crash.
    expect(verifyVerdict(VERDICT, "abc", SECRET, NOW)).toBe(false);
  });

  it("rejects an unparseable checked_at", () => {
    const v: Verdict = { ...VERDICT, checked_at: "not a date" };
    expect(verifyVerdict(v, signVerdict(v, SECRET), SECRET, NOW)).toBe(false);
  });

  it("accepts a verdict at the edge of the window", () => {
    const at = NOW + (VERDICT_WINDOW_SECONDS * 1000 - 1);
    expect(verifyVerdict(VERDICT, signed(), SECRET, at)).toBe(true);
  });

  it("rejects a verdict past the window", () => {
    const at = NOW + (VERDICT_WINDOW_SECONDS * 1000 + 1);
    expect(verifyVerdict(VERDICT, signed(), SECRET, at)).toBe(false);
  });

  it("rejects a verdict dated into the future", () => {
    // Without the absolute value, a postdated verdict would stay redeemable for as long as
    // its author cared to postdate it.
    const at = NOW - (VERDICT_WINDOW_SECONDS * 1000 + 1);
    expect(verifyVerdict(VERDICT, signed(), SECRET, at)).toBe(false);
  });

  it("defaults the clock to now", () => {
    const fresh: Verdict = { ...VERDICT, checked_at: new Date().toISOString() };
    expect(verifyVerdict(fresh, signVerdict(fresh, SECRET), SECRET)).toBe(true);
  });
});
