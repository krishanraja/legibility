import { describe, expect, it } from "vitest";
import { aggregate, bucket, CHOSEN, DEFECT, INCONCLUSIVE, type DomainReading } from "./cohort";
import { FAILURE_REASONS } from "./readability";

/**
 * This function published a wrong number about twenty named companies before it had a test.
 *
 * The page said "6 of 11 well-known sites could be read by a machine" on a twenty-site index,
 * because the figures were aggregated from a per-run view and observations deduplicate on
 * content, so the newest run held only the single page that had changed. The tests below are
 * about totals adding up and about the three buckets meaning what the page says they mean.
 */

const r = (domain: string, cohort: string, readable: boolean, reason: string | null = null) =>
  ({ domain, cohort, readable, failure_reason: reason }) satisfies DomainReading;

describe("aggregate", () => {
  it("counts one row per domain, not per observation", () => {
    const [c] = aggregate([r("a.com", "retail", true), r("b.com", "retail", false, "js_shell")]);
    expect(c).toMatchObject({
      cohort: "retail",
      observations: 2,
      domains: 2,
      readable: 1,
      unreadable: 1,
    });
  });

  it("splits cohorts and sorts them by name", () => {
    const out = aggregate([r("a.com", "retail", true), r("b.com", "news", true)]);
    expect(out.map((c) => c.cohort)).toEqual(["news", "retail"]);
  });

  it("attributes each failure to its own reason", () => {
    const [c] = aggregate([
      r("a.com", "x", false, "blocked"),
      r("b.com", "x", false, "blocked"),
      r("c.com", "x", false, "robots_disallowed"),
      r("d.com", "x", false, "no_structured_data"),
      r("e.com", "x", false, "timeout"),
    ]);
    expect(c.blocked).toBe(2);
    expect(c.robots_disallowed).toBe(1);
    expect(c.no_structured_data).toBe(1);
    expect(c.timeout).toBe(1);
    expect(c.unreadable).toBe(5);
  });

  it("readable and unreadable always sum to the number of domains", () => {
    const [c] = aggregate([
      r("a.com", "x", true),
      r("b.com", "x", false, "blocked"),
      r("c.com", "x", false, "error"),
    ]);
    expect(c.readable + c.unreadable).toBe(c.domains);
  });

  it("counts an unreadable row with no reason as unreadable but attributes it to nothing", () => {
    // The database constraint forbids this shape, so it cannot arrive from a sweep. If it
    // ever did, the headline must still add up rather than losing a site silently.
    const [c] = aggregate([r("a.com", "x", false, null)]);
    expect(c.unreadable).toBe(1);
    expect(bucket(c, CHOSEN) + bucket(c, DEFECT) + bucket(c, INCONCLUSIVE)).toBe(0);
  });

  it("ignores a reason outside the closed set rather than inventing a category", () => {
    const [c] = aggregate([r("a.com", "x", false, "vibes")]);
    expect(c.unreadable).toBe(1);
    expect(Object.keys(c)).not.toContain("vibes");
  });

  it("returns nothing for no readings, rather than a cohort of zero", () => {
    // A zero would render as a finding about sites nobody measured.
    expect(aggregate([])).toEqual([]);
  });

  it("gives every cohort a zero for every reason it did not see", () => {
    const [c] = aggregate([r("a.com", "x", true)]);
    for (const reason of FAILURE_REASONS) expect(c[reason]).toBe(0);
  });
});

describe("the three buckets", () => {
  it("partition the closed set exactly", () => {
    const all = [...CHOSEN, ...DEFECT, ...INCONCLUSIVE].sort();
    expect(all).toEqual([...FAILURE_REASONS].sort());
    expect(new Set(all).size).toBe(FAILURE_REASONS.length);
  });

  it("add up to the unreadable total for any mix of reasons", () => {
    const [c] = aggregate(FAILURE_REASONS.map((reason, i) => r(`d${i}.com`, "x", false, reason)));
    expect(bucket(c, CHOSEN) + bucket(c, DEFECT) + bucket(c, INCONCLUSIVE)).toBe(c.unreadable);
    expect(c.unreadable).toBe(FAILURE_REASONS.length);
  });

  it("keeps a refusal out of the defect column", () => {
    // The distinction the page is built on: refusing machines is a decision, and calling it
    // a defect would be an accusation against a publisher entitled to make it.
    const [c] = aggregate([
      r("a.com", "x", false, "blocked"),
      r("b.com", "x", false, "robots_disallowed"),
    ]);
    expect(bucket(c, CHOSEN)).toBe(2);
    expect(bucket(c, DEFECT)).toBe(0);
  });

  it("keeps an inconclusive read out of both", () => {
    const [c] = aggregate([r("a.com", "x", false, "timeout"), r("b.com", "x", false, "error")]);
    expect(bucket(c, INCONCLUSIVE)).toBe(2);
    expect(bucket(c, CHOSEN)).toBe(0);
    expect(bucket(c, DEFECT)).toBe(0);
  });
});
