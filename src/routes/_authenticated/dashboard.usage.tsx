import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Stats = { calls: number; cost_usd: number; cached_calls: number; live_calls: number };

function UsagePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // RPC binds to auth.uid() internally; the arg is ignored (kept for signature compat).
    supabase.rpc("usage_current_period", { _user_id: user.id }).then(({ data }) => {
      const row = Array.isArray(data) ? (data[0] as Stats | undefined) : undefined;
      setStats(row ?? { calls: 0, cost_usd: 0, cached_calls: 0, live_calls: 0 });
      setLoading(false);
    });
  }, [user]);

  const calls = stats?.calls ?? 0;
  // P3.5: zero-state showed a stray "·" glyph; render a clean "0%" instead.
  const cachedPct = calls > 0 ? Math.round((100 * (stats?.cached_calls ?? 0)) / calls) : 0;
  const cells: [string, string][] = [
    ["Calls", loading ? "…" : String(calls)],
    ["Cost", loading ? "…" : `$${Number(stats?.cost_usd ?? 0).toFixed(2)}`],
    ["Cached %", loading ? "…" : `${cachedPct}%`],
  ];

  return (
    <div>
      <h1 className="font-display text-4xl">Usage</h1>
      <p className="mt-3 text-muted-foreground">
        Calls, cost, cached vs live. This billing period.
      </p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-md border border-hairline bg-surface p-5">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {k}
            </div>
            <div className="mt-2 font-display text-3xl">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-2xl font-mono text-xs text-muted-foreground">
        Billable calls = live + cached × 0.1. A cached read costs a tenth of a live extraction.
      </p>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/usage")({ component: UsagePage });
