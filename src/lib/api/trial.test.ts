import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TRIAL_DEFAULTS,
  TRIAL_USED_UP_MESSAGE,
  autoTrialEnabled,
  grantErrorMessage,
  parseGrantForm,
  trialFuseCents,
} from "./trial";

const ROOT = resolve(__dirname, "../../..");

describe("trialFuseCents", () => {
  it("6. sizes the fuse from the allowance and the measured cost, so it never stops a trial early", () => {
    // 5,000 reads at a measured 1.2 cents a call: the trial's own fuse covers three times that.
    expect(trialFuseCents(5000, { calls: 100, avg_usd: 0.004, p95_usd: 0.012 })).toBe(18000);
    expect(trialFuseCents(5000, { calls: 100, avg_usd: 0.004, p95_usd: 0.012 })).toBeGreaterThan(
      5000 * 0.012 * 100,
    );
  });

  it("uses the Free plan's notional cost with no measurement, and never goes below Free's fuse", () => {
    expect(trialFuseCents(5000, null)).toBe(30000);
    expect(trialFuseCents(5000, { calls: 0, avg_usd: null, p95_usd: null })).toBe(30000);
    expect(trialFuseCents(5000, { calls: 5, avg_usd: null, p95_usd: 0.01 })).toBe(15000);
    expect(trialFuseCents(10, { calls: 5, avg_usd: 0.001, p95_usd: null })).toBe(
      TRIAL_DEFAULTS.minFuseCents,
    );
  });
});

describe("parseGrantForm", () => {
  it("defaults to the recommended trial", () => {
    expect(parseGrantForm({})).toEqual({
      ok: true,
      form: { allowance: 5000, days: 30, invitationId: null, costFuseCents: null },
    });
    expect(
      parseGrantForm({
        allowance: 2000,
        days: 14,
        invitationId: " legibility:x ",
        costFuseCents: "900",
      }),
    ).toEqual({
      ok: true,
      form: { allowance: 2000, days: 14, invitationId: "legibility:x", costFuseCents: 900 },
    });
  });

  it("4. refuses more than 30 days, and anything else malformed", () => {
    expect(parseGrantForm({ days: 31 }).ok).toBe(false);
    expect(parseGrantForm({ days: 0 }).ok).toBe(false);
    expect(parseGrantForm({ allowance: 0 }).ok).toBe(false);
    expect(parseGrantForm({ allowance: 1.5 }).ok).toBe(false);
    expect(parseGrantForm({ invitationId: "not one" }).ok).toBe(false);
    expect(parseGrantForm({ costFuseCents: -1 }).ok).toBe(false);
    expect(parseGrantForm({ costFuseCents: null }).ok).toBe(true);
    expect(parseGrantForm({ costFuseCents: "" }).ok).toBe(true);
  });
});

describe("words and switches", () => {
  it("2. the 402 says the trial is used up and that nothing was charged", () => {
    expect(TRIAL_USED_UP_MESSAGE).toContain("trial is used up");
    expect(TRIAL_USED_UP_MESSAGE).toContain("Nothing was charged");
  });

  it("names each refusal from the database", () => {
    expect(grantErrorMessage({ message: "trial_already_granted" })).toContain("already had");
    expect(grantErrorMessage({ message: "trial_too_long" })).toContain("1 to 30 days");
    expect(grantErrorMessage({ message: "invalid_invitation_id" })).toContain("invitation");
    expect(grantErrorMessage({ message: "other" })).toBe("That did not save.");
    expect(grantErrorMessage(null)).toBe("That did not save.");
  });

  it("automatic trials are off unless switched on", () => {
    expect(autoTrialEnabled({})).toBe(false);
    expect(autoTrialEnabled({ FOUNDING_AUTO_TRIAL: "1" })).toBe(false);
    expect(autoTrialEnabled({ FOUNDING_AUTO_TRIAL: "true" })).toBe(true);
  });

  it("7. the trial code never calls Stripe", () => {
    for (const f of [
      "src/lib/api/trial.ts",
      "src/lib/api/trials.functions.ts",
      "src/components/admin/Trials.tsx",
      "supabase/migrations/20261027170000_trial_grants.sql",
    ]) {
      const text = readFileSync(resolve(ROOT, f), "utf8");
      expect(text, f).not.toMatch(/api\.stripe\.com|stripePost|STRIPE_SECRET_KEY/);
    }
  });
});
