import { FAILURE_REASONS, type FailureReason } from "./readability";

/**
 * Roll the latest reading per domain up into one row per cohort.
 *
 * Pure, and separated from the server function that feeds it for the same reason classify()
 * is separated from the routes that call it: this is judgment, and judgment is what gets
 * tested. It earned that separation by being wrong in public. The index page originally
 * aggregated `cohort_readability`, which groups observations by sweep run, and took the
 * newest run as the state of the cohort. Observations deduplicate on content, so a sweep
 * where one page changed inserts exactly one row, and the newest run then describes only
 * what moved. The live page published "6 of 11 sites" for a twenty-site index.
 *
 * The input here is `domain_latest`, the newest observation per domain, which is the only
 * thing that answers "what is true now". The per-run view remains correct for the different
 * question of what a given run found.
 */

export type DomainReading = {
  domain: string;
  cohort: string;
  readable: boolean;
  failure_reason: string | null;
};

export type CohortSummary = {
  cohort: string;
  observations: number;
  domains: number;
  readable: number;
  unreadable: number;
} & Record<FailureReason, number>;

function emptyCounts(): Record<FailureReason, number> {
  return Object.fromEntries(FAILURE_REASONS.map((r) => [r, 0])) as Record<FailureReason, number>;
}

export function aggregate(readings: DomainReading[]): CohortSummary[] {
  const byCohort = new Map<string, CohortSummary>();

  for (const d of readings) {
    let row = byCohort.get(d.cohort);
    if (!row) {
      row = {
        cohort: d.cohort,
        observations: 0,
        domains: 0,
        readable: 0,
        unreadable: 0,
        ...emptyCounts(),
      };
      byCohort.set(d.cohort, row);
    }

    row.observations += 1;
    row.domains += 1;

    if (d.readable) {
      row.readable += 1;
      continue;
    }

    row.unreadable += 1;
    // A reason outside the closed set is counted as unreadable but not attributed, rather
    // than silently creating a category. The database constraint makes this unreachable from
    // a sweep; it is here because the page splits these counts into three columns and a
    // miscounted reason would move a site between "chose not to be read" and "could be read
    // and was not", which are opposite claims about whoever owns that domain.
    const reason = d.failure_reason as FailureReason | null;
    if (reason && reason in row) row[reason] += 1;
  }

  return [...byCohort.values()].sort((a, b) => a.cohort.localeCompare(b.cohort));
}

/** Reasons where the site decided. Not defects, and reported separately from them. */
export const CHOSEN: FailureReason[] = ["blocked", "robots_disallowed"];
/** Reasons where the page could have been read and was not. The finding that costs money. */
export const DEFECT: FailureReason[] = [
  "js_shell",
  "no_structured_data",
  "low_confidence",
  "not_a_product",
];
/** Reasons that are about the read, not the site. Never counted against anyone. */
export const INCONCLUSIVE: FailureReason[] = ["timeout", "error"];

// The three buckets must partition the closed set exactly. A reason in none of them would
// vanish from the page's totals while still counting as unreadable, so the columns would not
// add up to the headline; a reason in two would be counted twice.
//
// Enforced by cohort.test.ts rather than by a throw at module load. The invariant is over
// compile-time constants, so a test is the right place to assert it, and CI runs that test
// on every push. A runtime guard here would be unreachable in any build that ships, which
// means it could only ever be dead weight against the coverage gate.

/** Sum one bucket for a cohort. */
export function bucket(c: CohortSummary, keys: FailureReason[]): number {
  return keys.reduce((n, k) => n + c[k], 0);
}
