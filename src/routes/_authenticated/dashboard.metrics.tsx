import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMetrics } from "@/lib/api/metrics.functions";

// PLAN P4.1: admin-only North Star surface. Shows the weekly trusted-reads-per-account
// North Star, gate-pass rate by method (labelled NOT correctness), the latest golden
// precision-at-gate (the moat metric), and the kill dashboard. Near-zero until real
// users arrive, by design.
type Metrics = Awaited<ReturnType<typeof getMetrics>>;

function MetricsPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getMetrics()
      .then(setM)
      .catch(() => setM({ admin: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="font-mono text-xs text-muted-foreground">loading…</div>;
  if (!m || !m.admin) {
    return (
      <div>
        <h1 className="font-display text-4xl">Metrics</h1>
        <p className="mt-3 text-muted-foreground">This surface is available to Legibility admins only.</p>
      </div>
    );
  }

  const totalTrusted = m.weekly.reduce((s, w) => s + Number(w.trusted_reads), 0);
  const ev = m.latestEval as Record<string, unknown> | null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Metrics</h1>
        <p className="mt-2 text-muted-foreground">
          The North Star and its supporting signals. Numbers read near zero until real accounts make
          repeat trusted calls; the machinery is live and will light up on its own.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label="Trusted reads (8wk)" value={String(totalTrusted)} />
        <Tile
          label="Moat metric: precision at gate"
          value={ev ? `${Number(ev.precision_at_gate)}` : "n/a"}
          sub={ev ? `golden ${String(ev.calibration_version)}, Wilson low ${Number(ev.precision_wilson_low)}` : "no eval run"}
        />
        <Tile label="Active accounts (weeks)" value={String(new Set(m.weekly.map((w) => w.user_id)).size)} />
      </div>

      <Section title="Gate-pass rate by method (this is gate-pass, NOT correctness)">
        {m.byMethod.length === 0 ? (
          <Empty>No calls yet this window.</Empty>
        ) : (
          <Table
            head={["method", "calls", "gate pass", "rate"]}
            rows={m.byMethod.map((r) => [r.method, String(r.calls), String(r.gate_pass), String(r.gate_pass_rate)])}
          />
        )}
      </Section>

      <Section title="Kill dashboard (monthly review, one query)">
        <Table
          head={["signal", "value", "red threshold", "status"]}
          rows={m.kill.map((k) => [k.signal, k.value === null ? "no-data" : String(k.value), k.red_threshold, k.status])}
        />
      </Section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-hairline bg-surface p-5">
      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl">{value}</div>
      {sub && <div className="mt-1 font-mono text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-hairline bg-surface p-6 text-center font-mono text-xs text-muted-foreground">{children}</div>;
}
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-surface font-mono text-xs uppercase tracking-widest text-muted-foreground text-left">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-hairline font-mono text-xs">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="px-4 py-3 text-foreground">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/metrics")({ component: MetricsPage });
