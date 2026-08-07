# Ops

## Deploy

- The app is on **Vercel**. `main` auto-deploys; every PR gets a preview. CI
  (`.github/workflows/ci.yml`) runs a `secret-scan` job (gitleaks) plus a `verify`
  job: install, em-dash grep on `src/`, tsc, build, and a non-blocking lint. A
  committed secret fails the build.
- The **extraction worker** (`legibility-worker`) is a separate Vercel deploy.
- **Rollback:** promote the previous good deployment in the Vercel dashboard (or `vercel rollback`).
- **Migrations** apply to Supabase `cgkcplcamsijghalintq` via the Management API / MCP and are
  mirrored into `supabase/migrations/`.
- Quick read of system state: `GET /api/health` returns `{ status, checks: { worker, billing, x402 }, ts }`.
  200 with `status: ok` when the worker is reachable; 503 with `status: degraded` when it is not.
  `billing` and `x402` are `configured` / `off` reflecting whether their env is set.

## Monitoring (pg_cron)

Two cron jobs run on the `cgkc` Postgres. Both are service-role only.

### Cache TTL purge

`legibility-cache-purge`, every 30 minutes: `DELETE FROM product_cache WHERE expires_at < now()
OR takedown = true`. Keeps the table small and enforces takedowns promptly between reads.

### Daily rollup + kill-floor alert

`legibility-ops-daily`, 06:10 UTC: `compute_ops_daily()` then `check_kill_floor()`.

- `compute_ops_daily()` upserts one `ops_daily` row per day: `total_calls`, `trusted_reads`,
  `trust_rate` (trusted / total, the gate-pass rate), `error_calls`, `avg_latency_ms`,
  `total_cost_usd`, `active_accounts`.
- `check_kill_floor()` writes exactly one `ops_alerts` row per day (kind `trust_floor`) when the
  trailing 7-day trust rate is below **0.60** over at least 10 calls. That 0.60 is the
  KILL-CRITERIA floor (`docs/KILL-CRITERIA.md`).
- `kill_dashboard()` is the one-query monthly review: live trust rate, active accounts,
  outcome-report volume, and hard-domain share, each with its red threshold.

Alert DELIVERY (Resend email via pg_net) is roadmap (P5.3), not wired yet: until the channel and
key exist, alerts land in `ops_alerts` with `delivered = false`. Check the table (or run
`kill_dashboard()`) as part of the on-call review.

## Runbooks

### Extractor worker down

Symptom: tools return `upstream_unavailable` / `external_worker_not_configured`, or `/api/health`
shows `worker: down` (503).

1. Hit the worker's `/health` directly; check Vercel function logs for the worker project.
2. Confirm `PLINTH_EXTRACTOR_URL` and `PLINTH_EXTRACTOR_TOKEN` are set on the app. Without them
   `read_product` deliberately returns 503, not an unauthenticated call.
3. The app already serves from cache when possible and returns a clean error on a miss.
4. Note: the worker's extractor never throws; it returns a well-formed null envelope on any
   internal failure, so `upstream_unavailable` is a transport failure (worker unreachable), not
   an extractor crash.

### Cache poisoned

Symptom: a customer reports a wrong `brand` / `model` / `price`.

1. Find the `product_cache` row (key by URL or GTIN) via the Management API.
2. Delete the row. The next call re-extracts.
3. If the source page changed structurally, file a parser bug on the worker.
4. If poisoned by adversarial JSON-LD, restrict that host to structured-data-only on the worker
   (it already refuses to force-render high-anti-bot domains).

### Takedown received

1. Open the `takedown_requests` row.
2. Delete every `product_cache` row keyed on the URL.
3. Mark the source blocked so it is not re-cached (the purge cron also reaps `takedown = true`).
4. Reply to the requester within 24h.
5. Log it in `audit_log`.

### API key compromised

1. Revoke the key from the dashboard / set `revoked_at`.
2. Audit `usage_events` for the key; flag anomalies.
3. Email the owner the rotation steps (create new, then revoke old).

### Stripe webhook gap

This is the INBOUND Stripe webhook (`/api/stripe/webhook`) that tells us about subscription
events. Legibility does not offer customer-facing outbound webhooks (that is roadmap only).

1. Compare the Stripe dashboard to the local `subscriptions` table.
2. Replay missing events from the Stripe dashboard, or resend to `/api/stripe/webhook`.
3. On signature failures, rotate `STRIPE_WEBHOOK_SECRET` and redeploy.

## On-call

v1 default: the founder is on call. `/api/health`, the `ops_daily` / `ops_alerts` tables, Vercel
logs, and Supabase logs are the sources of truth until a status page exists.

## Observability

- **Health:** `/api/health` (worker reachability, billing and x402 configured).
- **North Star + monitoring:** `northstar_weekly` (weekly trusted reads per account),
  `trust_rate_by_method` (gate-pass rate by method, distinct from the golden precision metric),
  `golden_eval_runs` (precision at gate recorded pre-release), `ops_daily` / `ops_alerts`, and the
  admin metrics page `/dashboard/metrics`.
- **Vercel:** function logs and build logs for the app and the worker.
- **Supabase:** Postgres, PostgREST, and auth logs; `audit_log` table for sensitive actions.
- Product analytics (PostHog or similar) is not wired yet; add it before paid GA if needed.

## Backups

Supabase manages Postgres backups. The `product_cache` is rebuildable from source and is not in the
disaster-recovery critical path. Do a restore drill before GA.

## Secret rotation

Full procedure and the current founder queue live in `docs/security-rotation.md`. In short:

- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`: rotate the webhook secret every 90 days; delete
  and replace the secret key now (the beta `sk_live` keys were pasted in chat and are exposed).
- Supabase service-role key (`cgkc`): reset now (exposed), then redeploy both projects.
- `PLINTH_EXTRACTOR_TOKEN`: rotate on suspected exposure; set on the worker first, then the app, so
  the fail-closed sequence never opens a gap.
- `X402_RECIPIENT`: only changes if the payee wallet changes.
- Customer API keys: customer-driven; admin can force-revoke.
- CI (gitleaks) blocks any secret from being committed in the first place.

---

Last reviewed: 2026-07-06.
