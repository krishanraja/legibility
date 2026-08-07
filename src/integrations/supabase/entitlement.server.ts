// PLAN P2.4: monthly quota + cost fuse, enforced BEFORE the worker call so a free
// account cannot run unbounded real-cost extractions (closes audit P1-1). Fails SAFE:
// on an RPC error a free-tier caller is blocked conservatively rather than let through
// unlimited, while paid callers are allowed (never block a paying call on infra hiccup).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Entitlement = {
  allowed: boolean;
  reason: "ok" | "quota_exceeded" | "cost_fuse" | "degraded";
  plan_id: string;
  included_calls: number;
  used_billable: number;
};

export async function entitlementCheck(userId: string): Promise<Entitlement> {
  const { data, error } = await supabaseAdmin.rpc("entitlement_check", { _user_id: userId });
  const row = Array.isArray(data)
    ? (data[0] as
        | {
            allowed: boolean;
            reason: string;
            plan_id: string;
            included_calls: number;
            used_billable: number;
          }
        | undefined)
    : undefined;
  if (error || !row) {
    // Fail-safe: do not grant unlimited free calls on an RPC error.
    return {
      allowed: false,
      reason: "degraded",
      plan_id: "free",
      included_calls: 0,
      used_billable: 0,
    };
  }
  return {
    allowed: row.allowed,
    reason: (row.reason as Entitlement["reason"]) ?? "ok",
    plan_id: row.plan_id,
    included_calls: row.included_calls,
    used_billable: Number(row.used_billable),
  };
}

// The 402 body a route returns when quota or the cost fuse blocks a call.
export function quotaBlockedBody(e: Entitlement, upgradeUrl: string) {
  return {
    error: e.reason === "cost_fuse" ? "cost_fuse" : "quota_exceeded",
    message:
      e.reason === "cost_fuse"
        ? "This account has hit its free usage safety limit. Add a plan to continue."
        : `You have used all ${e.included_calls} included calls this month. Upgrade to continue.`,
    plan: e.plan_id,
    used: e.used_billable,
    included: e.included_calls,
    upgrade_url: upgradeUrl,
  };
}
