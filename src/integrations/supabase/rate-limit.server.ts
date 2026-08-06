// Server-only per-plan rate limiting (60s window count via the rate_check RPC).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RateResult = { allowed: boolean; used: number; limit: number; reset: number };

export async function rateCheck(userId: string): Promise<RateResult> {
  const { data, error } = await supabaseAdmin.rpc("rate_check", { _user_id: userId });
  const row = Array.isArray(data)
    ? (data[0] as
        | { allowed: boolean; used: number; lim: number; reset_seconds: number }
        | undefined)
    : undefined;
  // Fail-open: never block a paying call because the rate-limit infra hiccupped.
  if (error || !row) return { allowed: true, used: 0, limit: 0, reset: 60 };
  return { allowed: row.allowed, used: Number(row.used), limit: row.lim, reset: row.reset_seconds };
}

export function rateHeaders(r: RateResult): Record<string, string> {
  return {
    "x-ratelimit-limit": String(r.limit),
    "x-ratelimit-remaining": String(Math.max(0, r.limit - r.used)),
    "x-ratelimit-reset": String(r.reset),
  };
}
