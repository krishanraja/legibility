import { createServerFn } from "@tanstack/react-start";
import { aggregate, type CohortSummary } from "@/lib/api/cohort";

/**
 * The published machine-readability index.
 *
 * Public and unauthenticated: this is the number the product exists to publish. It reads
 * through the service role because `observations`, `sweep_runs` and the derived views are
 * service-role only by design, so the raw rows are never reachable from a browser and the
 * only way to see them is through the aggregate this returns.
 *
 * Called from the route loader so the figures are in the server-rendered HTML. A page that
 * argues sites should be machine readable cannot deliver its own central claim by JavaScript.
 *
 * The current state of the cohort is computed from `domain_latest`, which is the newest
 * observation per domain, and deliberately NOT from `cohort_readability`, which groups by
 * run. Those are different questions and the difference is not cosmetic. Observations
 * deduplicate on content, so a sweep that finds nothing changed inserts nothing and a sweep
 * that finds one page changed inserts one row. `cohort_readability` for the newest run then
 * describes only what moved, not what is true: the third sweep recorded a single changed
 * page, and reading the latest run as the cohort published "6 of 11 sites" on a twenty-site
 * index. The view is correct for what it answers, which is what a given run found. It is the
 * wrong question for a page describing the cohort now.
 */

export type CohortRow = CohortSummary;

export type DomainRow = {
  domain: string;
  cohort: string;
  method: string;
  readable: boolean;
  failure_reason: string | null;
  observed_at: string;
};

export type IndexPayload = {
  cohorts: CohortRow[];
  domains: DomainRow[];
  /** Null when no sweep has ever completed, which the page must say rather than imply zero. */
  lastRun: { finished_at: string | null; attempted: number; status: string } | null;
};

const EMPTY: IndexPayload = { cohorts: [], domains: [], lastRun: null };

export const getIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<IndexPayload> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The most recent completed run, so the page can date its own figures. A run still in
    // flight is excluded: publishing a half-written sweep as though it were finished is the
    // same class of error as publishing one that never ran.
    const [{ data: runs }, { data: domains }] = await Promise.all([
      supabaseAdmin
        .from("sweep_runs")
        .select("finished_at, attempted, status")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("domain_latest")
        .select("domain, cohort, method, readable, failure_reason, observed_at"),
    ]);

    if (!runs?.length || !domains?.length) return EMPTY;

    const rows = (domains as unknown as DomainRow[]).sort(
      (a, b) => a.cohort.localeCompare(b.cohort) || a.domain.localeCompare(b.domain),
    );

    return {
      cohorts: aggregate(rows),
      domains: rows,
      lastRun: runs[0] as IndexPayload["lastRun"],
    };
  },
);
