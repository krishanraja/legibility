/**
 * Outcome C: sweep the fixed cohort and record, per site, whether a machine can read it
 * and if not, why not.
 *
 * Two rules from the brief are load-bearing here and are implemented structurally rather
 * than by care:
 *
 *   Robots is obeyed. A site that disallows us is recorded as a data point and is never
 *   fetched. The credibility of the referee is the whole asset and it can be destroyed
 *   once, so the fetch is not merely skipped by convention: checkRobots runs before the
 *   page request exists, and a disallow returns a finished observation.
 *
 *   Spend is capped structurally. There is an item cap and a cost ceiling, both checked
 *   inside the loop, so a runaway sweep is impossible rather than unlikely.
 *
 * What this measures, precisely, because the published number has to say how it was made:
 * we issue one plain GET for the site's own homepage with an identifying user agent, and
 * classify the HTML that comes back. This is the same request an answer engine's crawler
 * makes. It deliberately does not run a headless browser and does not use the proxy-based
 * unblocker, which exists in the worker and stays switched off: a site being unreadable
 * without those is the finding, not a defect to work around.
 *
 * Usage:
 *   bun scripts/sweep.ts --json            classify and print, write nothing
 *   bun scripts/sweep.ts                   classify and write to Supabase
 *   bun scripts/sweep.ts --cohort retail   one cohort only
 */
import { createHash } from "node:crypto";
import cohortData from "../src/data/cohorts.json";
// One implementation of the verdict, shared with the public checker at /api/check. Two
// copies would drift, and the first public disagreement would end the index's credibility.
import { classify, isAllowedByRobots, type FailureReason } from "../src/lib/api/readability";

/** Identifies the crawler and points at a page explaining it. Never disguised. */
const USER_AGENT = "LegibilityBot/0.1 (+https://legibility.io/about/bot)";

/** Structural spend guards. Checked inside the loop, not asserted afterwards. */
const ITEM_CAP = 250;
const COST_CAP_USD = 5.0;

/** A plain GET costs nothing but bandwidth. Kept explicit so the cap means something. */
const COST_PER_FETCH_USD = 0;

const FETCH_TIMEOUT_MS = 15_000;

type Observation = {
  cohort: string;
  domain: string;
  target: string;
  method: string;
  readable: boolean;
  failure_reason: FailureReason | null;
  http_status: number | null;
  confidence: number | null;
  robots_allowed: boolean;
  cost_usd: number;
  envelope_hash: string;
  detail: string;
};

/**
 * Egress proxy, when the environment mandates one.
 *
 * Left unset in CI and in production, where this is direct. It exists because bun's fetch
 * does not read HTTPS_PROXY on its own, and in a sandbox that requires the proxy every
 * request fails at the socket. That failure mode is genuinely dangerous for this script:
 * an unreachable network classifies all twenty sites as unreadable and produces a
 * confident, catastrophic 100% that is purely an artefact of where it ran.
 */
const PROXY = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? undefined;

async function withTimeout(url: string, ms: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: ac.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      ...(PROXY ? { proxy: PROXY } : {}),
    } as RequestInit);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Second opinion on an alleged refusal, over a deliberately different client.
 *
 * curl differs from a JavaScript runtime's fetch in TLS fingerprint, header order and
 * HTTP version, which is exactly why it is the right cross-check: if both independent
 * paths are refused, the site is refusing machines rather than refusing one library.
 * Returns true only when the refusal reproduces.
 */
async function confirmRefusal(target: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      [
        "curl",
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "--max-time",
        "20",
        "-A",
        USER_AGENT,
        target,
      ],
      { stdout: "pipe", stderr: "ignore" },
    );
    const code = parseInt((await new Response(proc.stdout).text()).trim(), 10);
    if (!Number.isFinite(code) || code === 0) return false; // no second opinion, so no accusation
    return code === 403 || code === 401 || code === 429;
  } catch {
    return false;
  }
}

async function observe(cohort: string, site: { domain: string; target: string }) {
  const url = new URL(site.target);

  // Robots first, always. The page request does not exist until this passes.
  let robotsAllowed = true;
  try {
    const r = await withTimeout(`${url.origin}/robots.txt`, FETCH_TIMEOUT_MS);
    if (r.status === 200) {
      robotsAllowed = isAllowedByRobots(await r.text(), url.pathname, USER_AGENT);
    }
  } catch {
    robotsAllowed = true; // unreachable robots.txt means permitted, per the standard
  }

  if (!robotsAllowed) {
    return {
      cohort,
      domain: site.domain,
      target: site.target,
      method: "none",
      readable: false,
      failure_reason: "robots_disallowed" as const,
      http_status: null,
      confidence: null,
      robots_allowed: false,
      cost_usd: 0,
      envelope_hash: createHash("sha256").update(`robots_disallowed:${site.target}`).digest("hex"),
      detail: "robots.txt disallows this path for our user agent. Recorded, not fetched.",
    } satisfies Observation;
  }

  try {
    const res = await withTimeout(site.target, FETCH_TIMEOUT_MS);
    const html = await res.text();

    // Only pay for the second opinion when the first one alleges a refusal.
    let refusalConfirmed = true;
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      refusalConfirmed = await confirmRefusal(site.target);
    }

    const c = classify(res.status, html, refusalConfirmed);
    return {
      cohort,
      domain: site.domain,
      target: site.target,
      method: c.method,
      readable: c.readable,
      failure_reason: c.reason,
      http_status: res.status,
      confidence: null,
      robots_allowed: true,
      cost_usd: COST_PER_FETCH_USD,
      // Hash the classified content, not the raw bytes: a page with a rotating CSRF token
      // or a timestamp would otherwise produce a new hash on every sweep and defeat the
      // dedupe the whole time series depends on.
      envelope_hash: createHash("sha256")
        .update(`${res.status}|${c.method}|${c.readable}|${c.reason}|${c.detail}`)
        .digest("hex"),
      detail: c.detail,
    } satisfies Observation;
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message));
    return {
      cohort,
      domain: site.domain,
      target: site.target,
      method: "none",
      readable: false,
      failure_reason: (timedOut ? "timeout" : "error") as FailureReason,
      http_status: null,
      confidence: null,
      robots_allowed: true,
      cost_usd: COST_PER_FETCH_USD,
      envelope_hash: createHash("sha256")
        .update(`${timedOut ? "timeout" : "error"}:${site.target}`)
        .digest("hex"),
      detail: e instanceof Error ? e.message : String(e),
    } satisfies Observation;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes("--json");
  const only = args.includes("--cohort") ? args[args.indexOf("--cohort") + 1] : null;

  const cohorts = cohortData.cohorts.filter((c) => !only || c.id === only);
  if (cohorts.length === 0) {
    console.error(`No cohort matched "${only}".`);
    process.exit(1);
  }

  const observations: Observation[] = [];
  let spend = 0;
  let capped = false;

  outer: for (const cohort of cohorts) {
    for (const site of cohort.sites) {
      if (observations.length >= ITEM_CAP) {
        capped = true;
        console.error(`::warning::item cap ${ITEM_CAP} reached, stopping early`);
        break outer;
      }
      if (spend >= COST_CAP_USD) {
        capped = true;
        console.error(`::warning::cost cap $${COST_CAP_USD} reached, stopping early`);
        break outer;
      }
      const o = await observe(cohort.id, site);
      spend += o.cost_usd;
      observations.push(o);
      if (!jsonOnly) {
        const verdict = o.readable ? "readable" : (o.failure_reason ?? "?");
        console.error(`  ${o.domain.padEnd(22)} ${verdict.padEnd(19)} ${o.detail}`);
      }
    }
  }

  // A sweep that returns nothing fails loudly rather than passing quietly. This is the
  // difference between "every site is fine" and "the sweep never ran", which look
  // identical in a dashboard and are opposite findings.
  if (observations.length === 0) {
    console.error("::error::sweep produced zero observations. Failing loudly.");
    process.exit(1);
  }

  // The same failure wearing a different mask. A sweep whose network is broken does not
  // return zero rows, it returns a full set of confident failures: the first run of this
  // script in a sandboxed container reported 20 of 20 sites unreadable at 100%, which was
  // entirely an artefact of egress and would have been a catastrophic thing to publish
  // about twenty named companies. Transport-level errors are ours, not the sites', so a
  // run with too many of them is not a finding and must not be recorded.
  const transportErrors = observations.filter((o) => o.failure_reason === "error").length;
  const errorRate = transportErrors / observations.length;
  if (errorRate > 0.25) {
    console.error(
      `::error::${transportErrors}/${observations.length} observations are transport errors ` +
        `(${(100 * errorRate).toFixed(0)}%). That is a broken sweep, not a finding about these ` +
        `sites. Nothing recorded.`,
    );
    process.exit(1);
  }

  if (jsonOnly) {
    console.log(
      JSON.stringify({ observations, spend, capped, item_cap: ITEM_CAP, cost_cap: COST_CAP_USD }),
    );
    return;
  }

  const unreadable = observations.filter((o) => !o.readable);
  console.error(
    `\n${observations.length} observed, ${unreadable.length} unreadable ` +
      `(${((100 * unreadable.length) / observations.length).toFixed(0)}%), spend $${spend.toFixed(4)}`,
  );
}

if (import.meta.main) await main();
