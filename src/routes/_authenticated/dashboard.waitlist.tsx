import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getWaitlist, setWaitlistStatus, type WaitlistRow } from "@/lib/api/waitlist.functions";
import { REASON_COPY, type FailureReason } from "@/lib/api/readability";

/**
 * The waitlist, for whoever runs this.
 *
 * Before this screen the only way to see a signup was the Supabase table editor, and the
 * status column the schema has carried since the first migration had never been written by
 * anything. A capture form feeding a table nobody opens is a form that does not work,
 * whatever the insert returns.
 *
 * Each row carries the finding that converted the person, because that is the thing worth
 * acting on: a list of addresses is a mailing list, and a list of people who were just told
 * their site renders only in JavaScript is a conversation.
 */

type Payload = Awaited<ReturnType<typeof getWaitlist>>;

function when(iso: string) {
  return iso.slice(0, 10);
}

function Row({ row, onChange }: { row: WaitlistRow; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const reason = row.check?.failure_reason as FailureReason | null | undefined;

  const set = async (status: "pending" | "approved" | "rejected") => {
    setBusy(true);
    try {
      await setWaitlistStatus({ data: { id: row.id, status } });
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-sm text-foreground">{row.email}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {row.company ?? "no domain"} · {row.source ?? "unknown source"} · {when(row.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span
            className={
              row.status === "approved"
                ? "text-signal"
                : row.status === "rejected"
                  ? "text-muted-foreground line-through"
                  : "text-muted-foreground"
            }
          >
            {row.status}
          </span>
          {(["approved", "rejected", "pending"] as const)
            .filter((s) => s !== row.status)
            .map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => set(s)}
                className="rounded-sm border border-hairline px-2 py-1 text-muted-foreground hover:border-signal hover:text-signal disabled:opacity-50"
              >
                {s}
              </button>
            ))}
        </div>
      </div>

      {row.check && (
        <div className="mt-3 rounded-sm border border-hairline bg-surface p-3">
          <div className="font-mono text-xs text-foreground">
            {row.check.host} ·{" "}
            {row.check.readable ? "readable" : (row.check.failure_reason ?? "unknown")}
          </div>
          {!row.check.readable && reason && (
            <p className="mt-1 text-xs text-muted-foreground">{REASON_COPY[reason]}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WaitlistPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getWaitlist()
      .then(setPayload)
      .catch(() => setPayload({ admin: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <div className="font-mono text-xs text-muted-foreground">loading…</div>;

  if (!payload || !payload.admin) {
    return (
      <div>
        <h1 className="font-display text-4xl">Waitlist</h1>
        <p className="mt-3 text-muted-foreground">
          This surface is available to Legibility admins only.
        </p>
      </div>
    );
  }

  const rows = payload.rows ?? [];
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <h1 className="font-display text-4xl">Waitlist</h1>
      <p className="mt-3 text-muted-foreground">
        Everyone who asked for a read, newest first, with the finding that prompted it. {pending}{" "}
        pending of {rows.length}.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-md border border-hairline bg-surface p-6">
          <div className="font-display text-2xl">Nobody yet.</div>
          <p className="mt-2 text-sm text-muted-foreground">
            A row appears here when someone checks a domain and asks for the read.
          </p>
        </div>
      ) : (
        <div className="mt-8 divide-y divide-hairline border-y border-hairline">
          {rows.map((r) => (
            <Row key={r.id} row={r} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/waitlist")({
  component: WaitlistPage,
});
