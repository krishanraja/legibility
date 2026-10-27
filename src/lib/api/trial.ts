// A8: the 30-day trial. The defaults Krish decides at approval, the fuse sizing, the grant
// form's rules and the words, in one place. The enforcement is in the database
// (supabase/migrations/20261027170000_trial_grants.sql): a live grant serves reads until its
// allowance or its fuse, and otherwise the Free plan decides, so a trial is never worse than
// Free. Nothing here touches Stripe, subscriptions, checkout or rate_check.

import { invitationId } from "@/lib/api/attribution";

/**
 * The recommended defaults, each Krish's decision at the A8 approval: 5,000 trusted reads, the
 * clock starting at the grant, 30 days, then the Free plan. Grants are manual unless he turns
 * on FOUNDING_AUTO_TRIAL.
 */
export const TRIAL_DEFAULTS = {
  allowance: 5000,
  days: 30,
  /** The fuse covers this many times the measured cost of the allowance. */
  costSafetyFactor: 3,
  /** Used only when there is no measurement yet: the Free plan's notional cost per call. */
  fallbackCostPerCallUsd: 0.02,
  /** Never below the Free plan's own fuse. */
  minFuseCents: 3000,
} as const;

export type CostMeasurement = { calls: number; avg_usd: number | null; p95_usd: number | null };

/**
 * The trial's cost fuse, sized from the allowance and a read-only measurement of what a call
 * costs (trial_cost_per_call): the higher of the average and the 95th percentile, times the
 * allowance, times the safety factor. Free's 3,000-cent fuse would stop a 5,000-read trial early.
 */
export function trialFuseCents(allowance: number, measured: CostMeasurement | null): number {
  const perCall =
    measured && measured.calls > 0
      ? Math.max(Number(measured.avg_usd ?? 0), Number(measured.p95_usd ?? 0))
      : TRIAL_DEFAULTS.fallbackCostPerCallUsd;
  const cents = Math.ceil(allowance * perCall * 100 * TRIAL_DEFAULTS.costSafetyFactor);
  return Math.max(TRIAL_DEFAULTS.minFuseCents, cents);
}

export type GrantForm = {
  allowance: number;
  days: number;
  invitationId: string | null;
  costFuseCents: number | null;
};

/** The grant form, validated, or what to fix. The database refuses the same things again. */
export function parseGrantForm(
  body: Record<string, unknown>,
): { ok: true; form: GrantForm } | { ok: false; message: string } {
  const allowance = Number(body.allowance ?? TRIAL_DEFAULTS.allowance);
  const days = Number(body.days ?? TRIAL_DEFAULTS.days);
  if (!Number.isInteger(allowance) || allowance < 1 || allowance > 1_000_000) {
    return { ok: false, message: "The allowance must be a whole number of reads." };
  }
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return { ok: false, message: "A trial lasts from 1 to 30 days." };
  }
  const rawInv = typeof body.invitationId === "string" ? body.invitationId.trim() : "";
  const inv = rawInv ? invitationId(rawInv) : null;
  if (rawInv && !inv)
    return { ok: false, message: "That invitation id is not one the engine writes." };
  const fuse =
    body.costFuseCents === undefined || body.costFuseCents === null || body.costFuseCents === ""
      ? null
      : Number(body.costFuseCents);
  if (fuse !== null && !(Number.isFinite(fuse) && fuse > 0)) {
    return { ok: false, message: "The cost fuse must be a positive number of cents." };
  }
  return { ok: true, form: { allowance, days, invitationId: inv, costFuseCents: fuse } };
}

/** A refusal from grant_trial, in plain words. */
export function grantErrorMessage(error: { message?: string | null } | null | undefined): string {
  const m = error?.message ?? "";
  if (m.includes("trial_already_granted")) return "This account has already had its trial.";
  if (m.includes("trial_too_long")) return "A trial lasts from 1 to 30 days.";
  if (m.includes("invalid_invitation_id"))
    return "That invitation id is not one the engine writes.";
  return "That did not save.";
}

/**
 * The 402 words when a trial is used up and the Free plan's reads are used too. They say the
 * trial is used up and that nothing was charged. x402 calls never see them: an x402 call is paid.
 */
export const TRIAL_USED_UP_MESSAGE =
  "Your 30-day trial is used up, and so are this month's Free plan reads. Nothing was charged. Add a plan to continue, or wait for next month's Free reads.";

/** Whether Founding 200 sign-ups get a trial automatically (Krish's A8 decision; off by default). */
export function autoTrialEnabled(env: Record<string, string | undefined>): boolean {
  return env.FOUNDING_AUTO_TRIAL === "true";
}
