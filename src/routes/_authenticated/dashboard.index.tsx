import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getMyChecks, type CheckRow } from "@/lib/api/checks.functions";
import { REASON_COPY, REASON_FIX, type FailureReason } from "@/lib/api/readability";
import { demoCurl } from "@/config/product";

/**
 * The dashboard's first screen.
 *
 * It used to open "One call turns a URL or a barcode into a typed product object" over a curl
 * sample, which is a developer console for the old product. The person most likely to be
 * looking at it checked their domain on the front page, got a verdict, and made an account
 * because of it. So this leads with their domains and what was found, and the API keeps its
 * place one card further down for the audience llms.txt names as secondary.
 *
 * Checks are grouped by host so a repeat check reads as history rather than as a duplicate.
 */

type Grouped = { host: string; latest: CheckRow; earlier: CheckRow[] };

/** Newest first within a host, and hosts ordered by their most recent check. */
function groupByHost(checks: CheckRow[]): Grouped[] {
  const byHost = new Map<string, CheckRow[]>();
  for (const c of checks) {
    const list = byHost.get(c.host) ?? [];
    list.push(c);
    byHost.set(c.host, list);
  }
  return [...byHost.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => b.checked_at.localeCompare(a.checked_at));
      return { host: sorted[0].host, latest: sorted[0], earlier: sorted.slice(1) };
    })
    .sort((a, b) => b.latest.checked_at.localeCompare(a.latest.checked_at));
}

function when(iso: string) {
  return iso.slice(0, 16).replace("T", " ") + " UTC";
}

function Verdict({ check }: { check: CheckRow }) {
  const reason = check.failure_reason as FailureReason | null;
  return (
    <div className="rounded-md border border-hairline bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span className="text-foreground">{check.host}</span>
        <span>{when(check.checked_at)}</span>
      </div>
      <p className="font-display mt-3 text-2xl">
        {check.readable ? "A machine can read this site." : "A machine cannot read this site."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {check.readable
          ? `Structured data was found and parsed. Method: ${check.method}.`
          : (reason && REASON_COPY[reason]) || "The result was inconclusive."}
      </p>
      {!check.readable && reason && (
        <p className="mt-3 border-t border-hairline pt-3 text-sm">
          <span className="text-foreground">What would change it. </span>
          <span className="text-muted-foreground">{REASON_FIX[reason]}</span>
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-3 font-mono text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">verdict</dt>
          <dd className="mt-1 text-foreground">
            {check.readable ? "readable" : (check.failure_reason ?? "unknown")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">method</dt>
          <dd className="mt-1 text-foreground">{check.method}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">evidence</dt>
          <dd className="mt-1 text-foreground">{check.detail ?? "not recorded"}</dd>
        </div>
      </dl>
    </div>
  );
}

function Overview() {
  const [checks, setChecks] = useState<CheckRow[] | null>(null);

  useEffect(() => {
    let live = true;
    getMyChecks()
      .then((r) => {
        if (live) setChecks(r.checks);
      })
      .catch(() => {
        if (live) setChecks([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const groups = useMemo(() => (checks ? groupByHost(checks) : []), [checks]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl">Your sites</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every domain you have asked us to read, and what was found. A repeat check on the same
          site appears here as history rather than as a second entry.
        </p>
      </div>

      {checks === null && <p className="font-mono text-sm text-muted-foreground">Loading…</p>}

      {checks !== null && groups.length === 0 && (
        <div className="rounded-md border border-hairline bg-surface p-6">
          <div className="font-display text-2xl">Nothing read yet.</div>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Check a domain and ask for the read, and it appears here. Checks you made before
            creating this account are matched by email address, so anything you asked for with this
            address is already included.
          </p>
          <a
            href="/#check"
            className="mt-4 inline-block rounded-sm bg-signal px-3 py-2 font-mono text-xs text-background hover:opacity-90"
          >
            Check a site
          </a>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.host} className="space-y-3">
          <Verdict check={g.latest} />
          {g.earlier.length > 0 && (
            <details className="group rounded-md border border-hairline px-5 py-3">
              <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {g.earlier.length} earlier read{g.earlier.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 divide-y divide-hairline border-t border-hairline font-mono text-xs">
                {g.earlier.map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="text-muted-foreground">{when(c.checked_at)}</span>
                    <span className="text-foreground">
                      {c.readable ? "readable" : (c.failure_reason ?? "unknown")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}

      {/*
        The API, kept and demoted, in the same proportion the front page uses: the instrument
        behind the index rather than the headline.
      */}
      <div className="rounded-md border border-hairline bg-surface p-6">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          The reading engine, as an API
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          The same engine is a REST API and an MCP server, priced per call. Create a secret key on
          the{" "}
          <Link to="/dashboard/keys" className="text-signal underline">
            API keys
          </Link>{" "}
          page, then:
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre rounded-sm border border-hairline bg-background p-4 font-mono text-xs">
          {demoCurl()}
        </pre>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          The sample GTIN is real and returns a real object you can inspect. Swap in your key and
          run it as-is.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Full reference in the{" "}
          <a href="/docs" className="text-signal underline">
            docs
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: Overview });
