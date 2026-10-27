import { useCallback, useEffect, useState } from "react";

import { endTrial, getTrials, grantTrial } from "@/lib/api/trials.functions";

/**
 * A8: the Trials tab. Krish's own click here is the provisioning approval for a 30-day trial;
 * the growth engine only ever proposes one. The cost fuse defaults to a size measured from what
 * a call has cost over the last 30 days, and can be changed before granting.
 */

type Payload = Awaited<ReturnType<typeof getTrials>>;

const field =
  "rounded-sm border border-hairline bg-background px-2 py-1.5 font-mono text-xs text-foreground";
const button =
  "rounded-sm border border-hairline px-2 py-1 font-mono text-xs text-muted-foreground hover:border-signal hover:text-signal disabled:opacity-50";

export function Trials() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [allowance, setAllowance] = useState("");
  const [days, setDays] = useState("");
  const [invitation, setInvitation] = useState("");
  const [fuse, setFuse] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    getTrials()
      .then(setPayload)
      .catch(() => setPayload({ admin: false }));
  }, []);
  useEffect(load, [load]);

  if (!payload || !payload.admin) return null;
  const d = payload.defaults;
  const m = payload.measurement;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await grantTrial({
        data: {
          identifier,
          allowance: allowance ? Number(allowance) : undefined,
          days: days ? Number(days) : undefined,
          invitationId: invitation || undefined,
          costFuseCents: fuse ? Number(fuse) : undefined,
        },
      });
      setIdentifier("");
      setInvitation("");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        A trial serves trusted reads from the moment you grant it until its allowance, its cost fuse
        or its last day, then the account is on the Free plan. It is never worse than Free, and
        nothing is ever charged. Each account can have one trial.
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        Measured over 30 days:{" "}
        {m
          ? `${m.calls} calls, average ${m.avg_usd ?? "n/a"} USD, 95th percentile ${m.p95_usd ?? "n/a"} USD a call`
          : "no measurement"}
        . Default fuse for {d.allowance} reads: {d.costFuseCents} cents.
      </p>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Account id or sign-in address"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="account id or sign-in address"
          className={`${field} min-w-[240px] flex-1`}
        />
        <input
          aria-label="Allowance"
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
          placeholder={`${d.allowance} reads`}
          className={`${field} w-28`}
        />
        <input
          aria-label="Days"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder={`${d.days} days`}
          className={`${field} w-20`}
        />
        <input
          aria-label="Invitation id"
          value={invitation}
          onChange={(e) => setInvitation(e.target.value)}
          placeholder="invitation id (optional)"
          className={`${field} w-56`}
        />
        <input
          aria-label="Cost fuse in cents"
          value={fuse}
          onChange={(e) => setFuse(e.target.value)}
          placeholder={`fuse ${d.costFuseCents} cents`}
          className={`${field} w-36`}
        />
        <button type="submit" disabled={busy || identifier.trim() === ""} className={button}>
          grant trial
        </button>
      </form>
      {message && <p className="font-mono text-xs text-destructive">{message}</p>}

      {payload.trials.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-surface p-6 text-center font-mono text-xs text-muted-foreground">
          No trials granted yet.
        </div>
      ) : (
        <div className="divide-y divide-hairline rounded-md border border-hairline">
          {payload.trials.map((t) => (
            <div
              key={t.account_id}
              className="flex flex-wrap items-baseline justify-between gap-3 p-4 font-mono text-xs"
            >
              <div>
                <span className="text-foreground">{t.label ?? t.account_id}</span>
                <span className="ml-2 text-muted-foreground">
                  {t.used} of {t.allowance} reads, {t.starts_at.slice(0, 10)} to{" "}
                  {t.ends_at.slice(0, 10)}
                  {t.invitation_id ? `, ${t.invitation_id}` : ""}
                </span>
                <span className={`ml-2 ${t.live ? "text-signal" : "text-muted-foreground"}`}>
                  {t.live ? "live" : t.ended_at ? "ended early" : "over"}
                </span>
              </div>
              {t.live && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await endTrial({ data: { accountId: t.account_id } });
                      load();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={button}
                >
                  end now
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
