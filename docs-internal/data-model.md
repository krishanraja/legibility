# Data Model

Authoritative SQL lives in `supabase/migrations/`. This file summarises
the shape and the access rules. When a migration changes a table,
update this file in the same change.

## Tables

| Table                | Purpose                                                                    | RLS posture                                                                |
| -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `profiles`           | Per-user profile (display_name, company, email, approved, approved_at)     | Owner read/write via `auth.uid() = id`                                     |
| `user_roles`         | App roles (`admin`, `user`)                                                | Read via `has_role()` security-definer fn only; never selected client-side directly |
| `waitlist`           | Pre-launch sign-ups (email, company, use_case, status, source, approved_*) | Insert open to anon; select admin-only                                     |
| `plans`              | Plan catalogue (Free / Starter / Growth)                                   | Public read                                                                |
| `subscriptions`      | Owner to plan, status, period, Stripe ids                                  | Owner read; service_role writes                                            |
| `api_keys`           | Hashed key (sha256), prefix, last_four, name, last_used_at, revoked_at     | Owner read; insert/revoke via server fn                                    |
| `usage_events`       | Per-call meter + calibration observation (see columns below)               | Owner read; service_role inserts                                           |
| `product_cache`      | Typed product superset, ttl, confidence, field_confidence, legibility_id       | Service-role only; never read directly from the client                     |
| `outcome_reports`    | Downstream outcome-closure labels (the moat label channel)                 | Owner insert/read own via `auth.uid() = user_id`                           |
| `golden_eval_runs`   | Recorded pre-release eval (precision at gate, adversarial, recall, ECE)    | Service-role only, no policies                                             |
| `ops_daily`          | Daily usage rollup (trust rate, errors, latency, cost, active accounts)    | Service-role only                                                          |
| `ops_alerts`         | Kill-floor and error alerts raised by the monitoring cron                  | Service-role only                                                          |
| `audit_log`          | Admin/security audit trail (action, actor, target, meta)                   | Service-role writes; admin read                                            |
| `invoices`           | Stripe invoice mirror for in-app history                                   | Owner read                                                                 |
| `takedown_requests`  | Email, url, reason, status, notes                                          | Insert open; admin read/triage                                             |
| `resolutions`        | Reserved for an async resolve job model (resolve is sync; unused)          | Owner read; service_role writes                                            |
| `webhooks`           | Reserved; webhooks are not built (roadmap only)                            | Owner CRUD                                                                 |
| `webhook_deliveries` | Reserved; webhooks are not built (roadmap only)                            | Owner read                                                                 |

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
- `northstar_weekly(_since?)`: weekly trusted reads (`billable`) and total calls per account. This is
  the canonical North Star series.
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
