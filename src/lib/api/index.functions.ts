import { createServerFn } from "@tanstack/react-start";

/**
 * The published machine-readability index.
 *
 * Public and unauthenticated: this is the number the product exists to publish. It reads
 * through the service role because `observations`, `sweep_runs` and the derived views are
 * service-role only by design, so the raw rows are never reachable from a browser and the
 * only way to see them is through the aggregate this returns.
 *
 * Called from the route loader so the figures are in the server-rendered HTML. A page that
 * argues sites should be machine readable cannot itself deliver its central claim by
 * JavaScript.
 */

export type CohortRow = {
  cohort: string;
  observations: number;
  domains: number;
  readable: number;
  unreadable: number;
  unreadable_pct: string;
  blocked: number;
  js_shell: number;
  no_structured_data: number;
  not_a_product: number;
  low_confidence: number;
  timeout: number;
  robots_disallowed: number;
  error: number;
  last_observed: string;
};

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
    const [{ data: runs }, { data: cohorts }, { data: domains }] = await Promise.all([
      supabaseAdmin
        .from("sweep_runs")
        .select("finished_at, attempted, status")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1),
      supabaseAdmin.from("cohort_readability").select("*"),
      supabaseAdmin
        .from("domain_latest")
        .select("domain, cohort, method, readable, failure_reason, observed_at"),
    ]);

    if (!runs?.length || !cohorts?.length) return EMPTY;

    // cohort_readability is per cohort per run. Keep only the rows belonging to the newest
    // run so a second sweep does not double every count on the page.
    const byCohort = new Map<string, CohortRow>();
    for (const row of cohorts as unknown as (CohortRow & { last_observed: string })[]) {
      const seen = byCohort.get(row.cohort);
      if (!seen || row.last_observed > seen.last_observed) byCohort.set(row.cohort, row);
    }

    return {
      cohorts: [...byCohort.values()].sort((a, b) => a.cohort.localeCompare(b.cohort)),
      domains: ((domains ?? []) as unknown as DomainRow[]).sort(
        (a, b) => a.cohort.localeCompare(b.cohort) || a.domain.localeCompare(b.domain),
      ),
      lastRun: runs[0] as IndexPayload["lastRun"],
    };
  },
);
