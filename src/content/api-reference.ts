// The facts behind the public /docs/errors and /docs/rate-limits pages.
//
// These pages used to be written by hand and drifted from the code: they promised daily caps,
// concurrency limits, a 451 takedown error and a request_id on every error, none of which the
// API has ever done. The facts now live here, and api-reference.test.ts checks them against the
// sources that actually decide the behaviour (the rate_check migration, the plans seed and the
// error literals in the API routes). If a test here fails, the page is wrong, not the test.

/** Per-plan request budget. rate_check() allows plans.rate_per_sec * 60 calls per minute. */
export type RateRow = { planId: string; plan: string; perMinute: number };

export const RATE_LIMITS: RateRow[] = [
  { planId: "free", plan: "Free", perMinute: 60 },
  { planId: "starter", plan: "Starter", perMinute: 600 },
  { planId: "growth", plan: "Growth", perMinute: 3000 },
];

/** Budget for an account with no active or trialing subscription (rate_check fallback). */
export const NO_SUBSCRIPTION_PER_MINUTE = 60;

/** Window length in seconds. rate_check() returns it as reset_seconds. */
export const RATE_WINDOW_SECONDS = 60;

/** REST errors. `error` is the stable machine-readable field. */
export type ErrorRow = { status: number; error: string; when: string };

export const REST_ERRORS: ErrorRow[] = [
  { status: 400, error: "invalid_json", when: "The request body is not valid JSON." },
  {
    status: 401,
    error: "unauthorized",
    when: "No Authorization header, or the lgk_ key is unknown or revoked.",
  },
  {
    status: 402,
    error: "quota_exceeded",
    when: "A Free account has used its included trusted reads for this calendar month (UTC).",
  },
  {
    status: 402,
    error: "cost_fuse",
    when: "A Free account has hit its usage safety limit. Add a plan to continue.",
  },
  {
    status: 402,
    error: "trial_used_up",
    when: "A 30-day trial has used its reads, and the Free plan's reads for this month are used too. Nothing was charged.",
  },
  {
    status: 405,
    error: "method_not_allowed",
    when: "Wrong HTTP method. The v1 tools accept POST only; the Allow header says which.",
  },
  {
    status: 422,
    error: "invalid_request",
    when: "Wrong arguments, for example both url and gtin, neither, or not 2 to 5 URLs to compare.",
  },
  {
    status: 429,
    error: "rate_limited",
    when: "Over your plan's per-minute budget. Wait for retry-after seconds.",
  },
  { status: 500, error: "insert_failed", when: "report_outcome could not store the outcome." },
  {
    status: 502,
    error: "upstream_unavailable",
    when: "The extraction worker did not respond in time. Safe to retry.",
  },
  {
    status: 503,
    error: "external_worker_not_configured",
    when: "The extraction worker is not configured. Should not happen in production.",
  },
];

/** JSON-RPC errors from POST /api/mcp, with the HTTP status that carries them. */
export type McpErrorRow = { status: number; code: number; when: string };

export const MCP_ERRORS: McpErrorRow[] = [
  { status: 200, code: -32700, when: "The request body is not valid JSON." },
  { status: 200, code: -32601, when: "Unknown JSON-RPC method." },
  { status: 200, code: -32602, when: "Unknown tool name in tools/call." },
  {
    status: 402,
    code: -32098,
    when: "Keyed call: monthly quota reached, the Free usage safety limit hit, or a 30-day trial and this month's Free reads are both used up (nothing was charged).",
  },
  { status: 429, code: -32099, when: "Keyed call: over your plan's per-minute budget." },
  { status: 405, code: -32000, when: "GET instead of POST." },
];
