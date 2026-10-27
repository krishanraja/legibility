import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summariseWeek, type WeeklyKeyRow } from "@/lib/api/internal-accounts";

// PLAN P4.1: admin-only North Star metrics. The metric RPCs are service-role only, so
// this server function verifies the caller has the admin role, then reads them. A
// non-admin gets an empty (non-privileged) payload rather than an error.
export const getMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return { admin: false as const };

    const [weekly, byMethod, evalRun, kill, keysThisWeek] = await Promise.all([
      supabaseAdmin.rpc("northstar_weekly"),
      supabaseAdmin.rpc("trust_rate_by_method"),
      supabaseAdmin
        .from("golden_eval_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),
      supabaseAdmin.rpc("kill_dashboard"),
      // A1: the North Star number for this ISO week, internal accounts and keys excluded.
      supabaseAdmin.rpc("northstar_weekly_keys"),
    ]);

    return {
      admin: true as const,
      // null when the read failed (for example before the A1 migration is applied), so the
      // page says "not measured" rather than a zero nobody measured.
      thisWeek: keysThisWeek.error
        ? null
        : summariseWeek((keysThisWeek.data ?? []) as WeeklyKeyRow[]),
      weekly: (weekly.data ?? []) as {
        user_id: string;
        week: string;
        trusted_reads: number;
        total_calls: number;
      }[],
      byMethod: (byMethod.data ?? []) as {
        method: string;
        calls: number;
        gate_pass: number;
        gate_pass_rate: number;
      }[],
      latestEval: (evalRun.data ?? [])[0] ?? null,
      kill: (kill.data ?? []) as {
        signal: string;
        value: number | null;
        red_threshold: string;
        status: string;
      }[],
    };
  });
