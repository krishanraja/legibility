import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A8: the Trials tab on /dashboard/waitlist. Krish's own click there is the provisioning
 * approval; the growth engine only ever proposes a grant. Admin-gated like the waitlist and the
 * internal list; every grant and every early end is written to audit_log. Never calls Stripe.
 */

export type TrialRow = {
  account_id: string;
  label: string | null;
  starts_at: string;
  ends_at: string;
  ended_at: string | null;
  allowance: number;
  used: number;
  cost_fuse_cents: number;
  invitation_id: string | null;
  live: boolean;
};

async function isAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export const getTrials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) return { admin: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { trialFuseCents, TRIAL_DEFAULTS } = await import("@/lib/api/trial");

    const [grants, measured] = await Promise.all([
      supabaseAdmin
        .from("trial_grants")
        .select(
          "account_id, starts_at, ends_at, ended_at, allowance, cost_fuse_cents, invitation_id",
        )
        .order("starts_at", { ascending: false })
        .limit(500),
      supabaseAdmin.rpc("trial_cost_per_call"),
    ]);
    const m = measured.data?.[0] ?? null;
    const measurement = m
      ? {
          calls: Number(m.calls),
          avg_usd: m.avg_usd === null ? null : Number(m.avg_usd),
          p95_usd: m.p95_usd === null ? null : Number(m.p95_usd),
        }
      : null;

    const rows = grants.data ?? [];
    const ids = rows.map((g) => g.account_id);
    const profiles = ids.length
      ? ((await supabaseAdmin.from("profiles").select("id, email").in("id", ids)).data ?? [])
      : [];
    const emailOf = new Map(profiles.map((p) => [p.id, p.email]));
    const now = Date.now();
    const trials: TrialRow[] = await Promise.all(
      rows.map(async (g) => {
        const { count } = await supabaseAdmin
          .from("usage_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", g.account_id)
          .eq("billable", true)
          .gte("created_at", g.starts_at);
        return {
          ...g,
          label: emailOf.get(g.account_id) ?? null,
          used: count ?? 0,
          cost_fuse_cents: Number(g.cost_fuse_cents),
          live: !g.ended_at && Date.parse(g.ends_at) > now,
        };
      }),
    );
    return {
      admin: true as const,
      trials,
      measurement,
      defaults: {
        allowance: TRIAL_DEFAULTS.allowance,
        days: TRIAL_DEFAULTS.days,
        costFuseCents: trialFuseCents(TRIAL_DEFAULTS.allowance, measurement),
      },
    };
  });

export const grantTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      identifier: z.string().trim().min(1).max(320),
      allowance: z.number().int().optional(),
      days: z.number().int().optional(),
      invitationId: z.string().max(120).optional(),
      costFuseCents: z.number().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) throw new Error("Not permitted.");
    const { parseGrantForm, grantErrorMessage, trialFuseCents } = await import("@/lib/api/trial");
    const { parseAccountIdentifier } = await import("@/lib/api/internal-accounts");
    const parsed = parseGrantForm(data);
    if (!parsed.ok) throw new Error(parsed.message);
    const who = parseAccountIdentifier(data.identifier);
    if (!who) throw new Error("Enter an account id or the account's sign-in address.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lookup =
      who.kind === "id"
        ? supabaseAdmin.from("profiles").select("id").eq("id", who.id)
        : supabaseAdmin.from("profiles").select("id").ilike("email", who.email);
    const { data: found } = await lookup.limit(2);
    if (!found || found.length !== 1) throw new Error("No single account matches that.");
    const accountId = found[0].id;

    let fuse = parsed.form.costFuseCents;
    if (fuse === null) {
      const m = (await supabaseAdmin.rpc("trial_cost_per_call")).data?.[0];
      fuse = trialFuseCents(
        parsed.form.allowance,
        m ? { calls: Number(m.calls), avg_usd: m.avg_usd, p95_usd: m.p95_usd } : null,
      );
    }
    const { error } = await supabaseAdmin.rpc("grant_trial", {
      _account_id: accountId,
      _allowance: parsed.form.allowance,
      _days: parsed.form.days,
      _cost_fuse_cents: fuse,
      _invitation_id: parsed.form.invitationId,
      _granted_by: userId,
    });
    if (error) throw new Error(grantErrorMessage(error));
    await supabaseAdmin.from("audit_log").insert({
      actor: userId,
      action: "trial.granted",
      target: accountId,
      meta: { allowance: parsed.form.allowance, days: parsed.form.days, cost_fuse_cents: fuse },
    });
    return { ok: true };
  });

export const endTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ accountId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) throw new Error("Not permitted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("end_trial", { _account_id: data.accountId });
    if (error) throw new Error("That did not save.");
    await supabaseAdmin
      .from("audit_log")
      .insert({ actor: userId, action: "trial.ended", target: data.accountId, meta: {} });
    return { ok: true };
  });
