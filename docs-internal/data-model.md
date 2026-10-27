# Data Model

Authoritative SQL lives in `supabase/migrations/`. This file summarises
the shape and the access rules. When a migration changes a table,
update this file in the same change.

## Tables

| Table                | Purpose                                                                     | RLS posture                                                                         |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `profiles`           | Per-user profile (display_name, company, email, approved, approved_at)      | Owner read/write via `auth.uid() = id`                                              |
| `user_roles`         | App roles (`admin`, `user`)                                                 | Read via `has_role()` security-definer fn only; never selected client-side directly |
| `waitlist`           | Pre-launch sign-ups (email, company, use*case, status, source, approved*\*) | Insert open to anon; select admin-only                                              |
| `plans`              | Plan catalogue (Free / Starter / Growth)                                    | Public read                                                                         |
| `subscriptions`      | Owner to plan, status, period, Stripe ids                                   | Owner read; service_role writes                                                     |
| `api_keys`           | Hashed key (sha256), prefix, last_four, name, last_used_at, revoked_at      | Owner read; insert/revoke via server fn                                             |
| `usage_events`       | Per-call meter + calibration observation (see columns below)                | Owner read; service_role inserts                                                    |
| `product_cache`      | Typed product superset, ttl, confidence, field_confidence, legibility_id    | Service-role only; never read directly from the client                              |
| `outcome_reports`    | Downstream outcome-closure labels (the moat label channel)                  | Owner insert/read own via `auth.uid() = user_id`                                    |
| `golden_eval_runs`   | Recorded pre-release eval (precision at gate, adversarial, recall, ECE)     | Service-role only, no policies                                                      |
| `ops_daily`          | Daily usage rollup (trust rate, errors, latency, cost, active accounts)     | Service-role only                                                                   |
| `ops_alerts`         | Kill-floor and error alerts raised by the monitoring cron                   | Service-role only                                                                   |
| `audit_log`          | Admin/security audit trail (action, actor, target, meta)                    | Service-role writes; admin read                                                     |
| `invoices`           | Stripe invoice mirror for in-app history                                    | Owner read                                                                          |
| `takedown_requests`  | Email, url, reason, status, notes                                           | Insert open; admin read/triage                                                      |
| `resolutions`        | Reserved for an async resolve job model (resolve is sync; unused)           | Owner read; service_role writes                                                     |
| `webhooks`           | Reserved; webhooks are not built (roadmap only)                             | Owner CRUD                                                                          |
| `webhook_deliveries` | Reserved; webhooks are not built (roadmap only)                             | Owner read                                                                          |

## Roles

`app_role` enum: `admin`, `user`. Roles live in `user_roles`, NEVER on
`profiles`. The `public.has_role(_user_id, _role)` security-definer
function is the only legitimate way to check role membership. Use it
in RLS policies and admin gates.

## usage_events columns

Every keyed call writes one row. Beyond the meter fields (`tool`, `endpoint`, `status`, `cost_usd`,
`latency_ms`, `cached`, `api_key_id`, `user_id`, `created_at`) each row is a calibration observation:

- `request_id`: worker request id, the join key for `outcome_reports`.
- `confidence`: `NUMERIC(5,4)` overall confidence stamped from the returned envelope (null when the
  response was not a well-formed envelope).
- `product_returned`: true when the envelope carried a non-null product object.
- `billable`: true only when a **trusted product** came back (`product_returned` AND
  `confidence >= 0.7`). Quota and overage count `billable` reads only; nulls and low-confidence reads
  are free.
- `domain`: hostname of the requested URL, or `gtin:` / `name:` for non-URL inputs. Per-domain and
  per-method reliability keys on this.
- `envelope_hash`: SHA-256 of the raw response body, the audit-trail anchor.
- `calibration_version`: the calibration fit that produced `confidence`.

## product_cache columns

`cache_key`, `url`, `gtin`, `method`, `product` (JSONB typed superset), `confidence`, `fetched_at`,
`expires_at`, `created_by`, `takedown`, plus:

- `field_confidence` (JSONB): per-field calibrated confidence, returned on cache hits so a repeat
  read is not thinner than the first.
- `calibration_version`: keeps a cached confidence auditable across recalibrations.
- `legibility_id`: opaque minted product identity (`pl_...`), stable across re-reads, **never derived**
  from URL or GTIN. Unique index on non-null values. This is the moat anchor: customers store it as
  a foreign key, and longitudinal history accumulates under it.

## The internal list (A1)

Service role only: RLS on with no policy, and the default grants to `anon` and `authenticated`
revoked, so both get "permission denied". Membership is written at run time by an admin on
`/dashboard/metrics` (each change lands in `audit_log`), never by a migration or seed.

- `internal_accounts`: `account_id` (PK, `auth.users`), `class` (one of `krish`, `engine`,
  `testbench`, `directory_test`, `registry`, `ci`, `demo`, `smoke`), `added_at`, `added_by` (the
  admin's account id). Every account here, and every key on it, is internal.
- `internal_keys`: `key_id` (PK, `api_keys`), `class`, `added_at`. A class label for one key. A
  trigger refuses a key whose account is not in `internal_accounts`, and taking an account off the
  list removes its key labels, so `is_internal` on the account is always enough.

## Attribution (A2)

Where a builder came from, so a production agent can be traced to the channel that earned it.
Service role only, like the internal list. Never stored: an email address, an IP address (an
IPv4 literal is refused in every field), a name, a product input, a key, a full User-Agent, or a
referrer's path or query.

- The touch. A page load with any `utm_*` tag or from a recognised MCP directory (by our own
  listing tags, or one referrer host per directory in `src/lib/api/attribution.ts`) stores the
  latest touch in the first-party `lg_touch` cookie for 30 days: the invitation id (`utm_content`
  only when it matches `legibility:...`, at most 120 characters), `utm_source`, `utm_medium`,
  `utm_campaign` (lowercased, `^[a-z0-9][a-z0-9._:-]{0,99}$`, otherwise null), the referrer's
  host, the directory and the time. Written by `recordLanding()` in `src/lib/attribution-client.ts`.
- `attribution_touches`: `kind` (`landing`, `enrolment`, `key_creation`), `account_id`, `key_id`,
  the touch fields, `client`, `channel` (generated by `attribution_channel()`), `occurred_at` (when
  the builder arrived through it). One enrolment touch per account and one touch per key; every
  field is validated again by CHECKs.
  - Enrolment: the sign-in form passes the cookie as sign-up metadata, which Supabase keeps only
    when it creates the account; the trigger `on_auth_user_created_attribution` turns it into the
    enrolment touch and never blocks a sign-up.
  - Key creation: `createApiKey` calls `record_key_creation(key, cookie touch)`. With no touch in
    the session the key inherits the enrolment touch; a key that already has a touch is never
    rewritten, so a key made before a touch keeps its earlier history.
  - Client: `record_key_client(key, client)` keeps the first client once: the MCP `initialize`
    request's `clientInfo.name` when it carries the key, or for REST the User-Agent's first
    product token without its version (on the key's first use).
- `growth_events`: server-side growth events (`type`, `account_id`, `source` = the channel label,
  `occurred_at`): `email_verified` (once per account, `record_email_verified`, which also tells
  the browser to send `sign_up` exactly once) and `key_created`. The export (A4) reads this.
- `account_acquisition_source(account)`: `internal` for an account on the internal list, else the
  enrolment touch's label, else `direct`. Labels, in order: `introduction` (an invitation id with
  `utm_medium=introduction`), `invitation`, `directory:<directory>`, `utm:<utm_source>`,
  `referrer:<host>`, `direct`.

GA4 and PostHog receive `generate_lead` (the home page's lead form today; the Founding 200 form
in A3), `sign_up` and `test_run` (A3), with the invitation id and the label only
(`trackGrowth` in `src/lib/analytics.ts`). They are cross-checks; the export never reads them.

## Functions

Role and usage:

- `has_role(_user_id, _role)` security-definer: the only legitimate role check.
- `usage_current_period(_user_id?)` security-definer: aggregates current-period usage
  (`calls`, `live_calls`, `cached_calls`, `cost_usd`).
- `rate_check(_user_id)` security-definer: 60-second sliding-window count over `usage_events`;
  returns `{ allowed, used, lim, reset_seconds }`. Budget is `plans.rate_per_sec * 60` per minute.

Billing and North Star (all `REVOKE`d from `public`/`anon`/`authenticated`, service-role only):

- `entitlement_check(_user_id)`: monthly quota + free cost fuse, evaluated before the worker call.
  Returns `{ allowed, reason, plan_id, included_calls, used_billable, cost_spent_cents }` where
  `reason` is `ok` | `quota_exceeded` | `cost_fuse`. Free tier hard-stops at `included_calls` and
  trips a cost fuse (~3000 cents). Paid tiers are never hard-blocked here (overage is a roadmap item).
- `northstar_weekly(_since?)`: weekly trusted reads (`billable`) and total calls per account,
  internal accounts excluded since A1 (signature and default unchanged).
- `northstar_weekly_keys(_week_start?)`: the North Star number. One row per ISO week (Monday
  00:00 UTC to the next Monday, computed in UTC whatever the session time zone) and external key
  with at least one trusted read, with that key's count; the number for a week is the count of its
  rows. Any date selects its week; the default is this week. Returns
  `{ iso_week, week_start, key_id, trusted_reads }`.
- `read_interface(_endpoint)`: `mcp` for `/api/mcp`, `api` for `/api/v1/*`, `testbench` for
  anything else (a testbench, quickstart or sample read, or no endpoint), which never counts.
- `is_trusted_read(_endpoint, _product_returned, _confidence, _calibration_version)`: the one
  definition of a trusted read: through `api` or `mcp`, a product came back, confidence at least
  0.7, and a non-empty calibration version.
- `trust_rate_by_method(_since?)`: per-method call count, gate-pass count, and gate-pass rate. This
  is gate-pass, not correctness; the metrics page shows it next to precision-at-gate from
  `golden_eval_runs` and must never conflate the two.
- `kill_dashboard()`: the SQL-checkable kill signals in one query (live trust rate vs the 0.60 floor,
  28-day active accounts, 30-day outcome reports, hard-domain share).
- `compute_ops_daily(_day?)`: idempotent upsert of one day of `usage_events` into `ops_daily`.
- `check_kill_floor()`: writes one `ops_alerts` row/day when the trailing 7-day trust rate is below
  0.60 over at least 10 calls.

`compute_ops_daily` then `check_kill_floor` run daily at 06:10 UTC on `pg_cron`. Alert delivery to a
channel (Resend via `pg_net`) is a roadmap item, wired when the channel and key exist.

`plans` carries `rate_per_sec`, `burst_per_sec`, `included_calls`, `overage_cents_per_call`,
`price_cents`, `stripe_price_id`, `active`, and `sort_order`. `product_cache` is purged by a
`pg_cron` job on TTL.

## Retention

- `product_cache`: 7 days default TTL; 1 hour for high-volatility fields (price, availability).
  Manual purge via admin; automatic purge on takedown.
- `usage_events`: 90 days at minimum, longer for billing reconciliation.
- `ops_daily` / `golden_eval_runs` / `outcome_reports`: kept (small, longitudinal, and the moat
  record).
- `waitlist`: kept until launch, then archived.

## Product cache shape (typed Product superset)

The `product` JSONB stored per row (the object the worker returns, cached only for trusted reads):

```jsonc
{
  "title", "brand", "gtin", "description", "category",
  "attributes": { /* normalised: storage_gb, color, screen_size_in, ... */ },
  "images": ["..."],
  "price": { "low", "high", "currency", "as_of", "n_sources" },
  "availability": "in_stock|out_of_stock|preorder|unknown",
  "variants": [{ "title", "attributes" }]
}
```

Confidence, field confidence, calibration version, and the minted `legibility_id` live in their own
columns (above), not inside the `product` blob. The cache key is the normalised input (URL, GTIN, or
canonical fuzzy hash). Only trusted products (`confidence >= 0.7`) are written; below-gate reads are
not cached.

## PII

We do not store buyer PII. The cache keys on public references (URLs and GTINs). `usage_events`
stores the key id, tool, the requested `domain` (a public hostname, or `gtin:` / `name:`), and an
`envelope_hash`, never the request body beyond what is needed for the cache. `outcome_reports`
stores only the agent's own key identity plus the outcome label and an optional observed price.

---

Last reviewed: 2026-07-06.
