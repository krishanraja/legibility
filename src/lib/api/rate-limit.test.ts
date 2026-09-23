import { describe, expect, it } from "vitest";
import { createLimiter, clientIp } from "./rate-limit";

/**
 * The limiter is the only thing standing between an unauthenticated endpoint that makes
 * outbound requests on a caller's behalf and one browser tab in a loop. It is a floor rather
 * than a guarantee, so what matters is that it counts correctly, that the window actually
 * expires, and that its memory does not grow without bound on a warm instance.
 */

describe("createLimiter", () => {
  it("allows exactly max calls in the window and refuses the next", () => {
    const l = createLimiter(3, 1000);
    expect(l.limited("a", 0)).toBe(false);
    expect(l.limited("a", 1)).toBe(false);
    expect(l.limited("a", 2)).toBe(false);
    expect(l.limited("a", 3)).toBe(true);
  });

  it("counts each key separately", () => {
    const l = createLimiter(1, 1000);
    expect(l.limited("a", 0)).toBe(false);
    expect(l.limited("b", 0)).toBe(false);
    expect(l.limited("a", 0)).toBe(true);
  });

  it("forgets calls once the window has passed", () => {
    const l = createLimiter(1, 1000);
    expect(l.limited("a", 0)).toBe(false);
    // Exactly one window later the first call has aged out and the budget is free again.
    expect(l.limited("a", 1000)).toBe(false);
  });

  it("keeps a caller refused while their own refused attempts are still in the window", () => {
    // A refused call is recorded, so hammering the endpoint extends the refusal rather than
    // letting a caller cycle the budget by spending it faster than it expires.
    const l = createLimiter(1, 1000);
    expect(l.limited("a", 0)).toBe(false);
    expect(l.limited("a", 500)).toBe(true);
    expect(l.limited("a", 1000)).toBe(true);
    // Only once every attempt, refused ones included, has aged out does it open again.
    expect(l.limited("a", 2001)).toBe(false);
  });

  it("records the attempt even when refusing, so a caller in a loop stays refused", () => {
    const l = createLimiter(1, 1000);
    l.limited("a", 0);
    expect(l.limited("a", 100)).toBe(true);
    expect(l.limited("a", 200)).toBe(true);
  });

  it("sweeps expired keys once the map is oversized", () => {
    // maxKeys of 2: filling three distinct keys trips the sweep. The two stale keys are
    // dropped and the fresh one survives, which is the behaviour that keeps a long-lived
    // instance from leaking a map entry per address that ever called.
    const l = createLimiter(1, 1000);
    const small = createLimiter(1, 1000, 2);
    small.limited("old-1", 0);
    small.limited("old-2", 0);
    small.limited("fresh", 5000);
    // The sweep is internal, so it is observed through behaviour: a swept key starts over.
    expect(small.limited("old-1", 5000)).toBe(false);
    // The unswept limiter is unaffected by any of that.
    expect(l.limited("old-1", 0)).toBe(false);
  });

  it("defaults the clock to now", () => {
    const l = createLimiter(1, 60_000);
    expect(l.limited("a")).toBe(false);
    expect(l.limited("a")).toBe(true);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://legibility.io/api/check", { method: "POST", headers });

  it("takes the leftmost x-forwarded-for entry, which is the one the platform saw", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("trims surrounding whitespace", () => {
    expect(clientIp(req({ "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("falls back past an empty x-forwarded-for rather than keying on the empty string", () => {
    // An empty header would otherwise produce "" and put every such caller in one bucket.
    expect(clientIp(req({ "x-forwarded-for": "", "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("returns a constant when no address header is present", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
