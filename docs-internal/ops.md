# Ops

## Deploy

- The app is on **Vercel**. `main` auto-deploys; every PR gets a preview. CI
  (`.github/workflows/ci.yml`) runs a `secret-scan` job (gitleaks) and a `verify` job, every step
  a hard gate: install, the em dash check, `bun run format:check`, `bunx tsc --noEmit`,
  `bun run lint`, `bunx vitest run --coverage` (100% on the money path, and the PGlite migration
  tests in `src/test/db/`), `bun run build`, the two database checks (calibration figures and plan
  figures against the live tables, run only when the service-role secret is present), the
  `llms-full.txt` check and the GEO check. A committed secret fails the build.
- The **extraction worker** (`legibility-worker`) is a separate Vercel deploy.
- **Rollback:** promote the previous good deployment in the Vercel dashboard (or `vercel rollback`).
- **Migrations** go in this order: write the SQL in `supabase/migrations/`, test it in PGlite
  (`src/test/db/`), apply it to the Supabase project named in `supabase/config.toml` (Management
  API or MCP), and only then merge code that reads it. Never apply to any other project: the
  project this app used before 2026-09-23 now belongs to CTRL.
- Quick read of system state: `GET /api/health` returns `{ status, checks: { worker, billing, x402 }, ts }`.
  200 with `status: ok` when the worker is reachable; 503 with `status: degraded` when it is not.
  `billing` and `x402` are `configured` / `off` reflecting whether their env is set.

## Monitoring (pg_cron)

Two cron jobs run on the production Postgres. Both are service-role only.

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
2. Confirm `LEGIBILITY_EXTRACTOR_URL` and `LEGIBILITY_EXTRACTOR_TOKEN` are set on the app. Without them
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
2. Delete every `product_cache` row keyed on the URL, or set `takedown = true` on it (the purge
   cron reaps those within 30 minutes).
3. The app has no blocklist and returns no 451: a later call for the same URL reads it again and
   caches a trusted result. If the rights holder needs re-caching blocked, that has to be built
   (in the worker or the app) first; say so in the reply rather than promising it.
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

### Growth export token (rotate or make it dedicated)

`GET /api/internal/growth/export` accepts one bearer token, held only as its hash
(`GROWTH_EXPORT_TOKEN_SHA256`). Today that hash is of the growth engine's Control Center bearer
(set in A4), and growth-legibility sends `LEGIBILITY_EXPORT_TOKEN` when it has one and that bearer
otherwise. So rotating the engine's Control Center bearer makes every export answer 401 until the
hash here is replaced in the same step. To give the export a token good for this route only:

1. Generate a random token of at least 32 bytes (for example `openssl rand -hex 32`).
2. Compute its lowercase hex SHA-256 (`printf %s "$TOKEN" | sha256sum`).
3. Set that hash as `GROWTH_EXPORT_TOKEN_SHA256` in Vercel, Production, and redeploy. This
   revokes the old token at once.
4. Add the token itself to growth-legibility as the `LEGIBILITY_EXPORT_TOKEN` secret.
5. Check: `curl -s -o /dev/null -w "%{http_code}" -H "authorization: Bearer $TOKEN"
"https://legibility.io/api/internal/growth/export?start=2026-10-26T00:00:00Z&end=2026-10-27T00:00:00Z"`
   returns 200, and the same call with a wrong token returns 401.

`EXPORT_ID_KEY` keys the export's opaque ids and the Founding 200 IP hash. Rotating it changes
every id the engine holds and resets the per-IP limits, so only with Krish's yes. Unset, the
export answers 503 and the Founding 200 page refuses every run.

### Open the Founding 200 page

The page (`/founding-200`) shows "paused" and refuses every run until both Turnstile keys exist.

1. In Cloudflare, create a Turnstile widget for the `legibility.io` hostname.
2. Set its site key as `TURNSTILE_SITE_KEY` and its secret as `TURNSTILE_SECRET_KEY` in Vercel,
   Production. The page also needs `EXPORT_ID_KEY` and the worker variables, which are set.
3. Redeploy, open `/founding-200`, and check the form shows the challenge and no longer says the
   test is paused. Run it once on a real product.

Turnstile fails closed: with no secret, a network error or a bad token, the run is refused. The
limits (5 runs per IP and 20 per product domain each UTC day, 200 a day in all, $3 a day of worker
cost) are code, `FOUNDING_LIMITS` in `src/lib/api/founding.ts`; changing one is a pull request.
Today's spend is the sum of `founding_runs.cost_usd` for today's `day`. The offer the page states
follows `FOUNDING_AUTO_TRIAL` (see the trial runbook below).

### Publish to the MCP Registry

The registry entry is `server.json` at the repository root (`io.legibility/mcp`). Publishing
proves control of legibility.io over HTTP, so no DNS change is needed. Check the publisher CLI's
syntax against the registry's current guide before running it.

1. Generate an ed25519 key pair on Krish's machine (for example
   `openssl genpkey -algorithm ed25519 -out registry.pem`). The private half never leaves it.
2. Take the raw public half in base64, 44 characters ending in `=`
   (`openssl pkey -in registry.pem -pubout -outform DER | tail -c 32 | base64`), and set it as
   `MCP_REGISTRY_AUTH_PUBLIC_KEY` in Vercel, Production. Redeploy.
3. Check `https://legibility.io/.well-known/mcp-registry-auth` returns
   `v=MCPv1; k=ed25519; p=` followed by that public half (it is 404 until set).
4. With the registry's publisher CLI, log in with HTTP domain auth for `legibility.io` using the
   private half, then publish from the repository root.
5. Each release, bump `SERVER_INFO.version` in `src/lib/api/mcp-tools.ts` and `version` in
   `server.json` together; the tests fail when they differ.

### Add an account to the internal list

Every account Krish, the growth engine, CI, demos or smoke tests use belongs on the list, so it
never counts toward the North Star. Today it holds one account, Krish's.

1. Sign in as an admin and open `/dashboard/metrics`, the internal list.
2. Enter the account id or its sign-in address, choose a class (`krish`, `engine`, `testbench`,
   `directory_test`, `registry`, `ci`, `demo`, `smoke`) and add it. A key on it can also carry a
   class of its own. Each change lands in `audit_log`.

### Grant or end a trial

1. Sign in as an admin and open `/dashboard/waitlist`, the Trials tab.
2. Enter the account id or sign-in address, and optionally the allowance (default 5,000 reads),
   the days (at most 30), an invitation id from the growth engine and a cost fuse in cents (by
   default sized from the measured cost a call shown on the tab). An account gets one trial ever.
3. End a live trial early from its row. The account is then on Free.

`FOUNDING_AUTO_TRIAL=true` in Vercel gives every new Founding 200 key the default trial
automatically and switches the page's offer to say so; off by default. The trial was shipped with
the proposed defaults (5,000 reads, the clock from the grant, Free from day 30, automatic trials
off) under the A1 to A8 go-ahead; Krish may still change them.

### Change the auth emails

The four branded Supabase auth emails live in `supabase/templates/`, byte for byte what the hosted
project sends. The other auth emails are Supabase's defaults.

| File                | Supabase field                          | Subject                           |
| ------------------- | --------------------------------------- | --------------------------------- |
| `magic-link.html`   | `mailer_templates_magic_link_content`   | Your Legibility sign-in link      |
| `confirmation.html` | `mailer_templates_confirmation_content` | Confirm your Legibility account   |
| `recovery.html`     | `mailer_templates_recovery_content`     | Reset your Legibility access      |
| `email-change.html` | `mailer_templates_email_change_content` | Confirm your new Legibility email |

1. Edit the file. Use token colours only: `src/test/brand-colours.test.ts` fails on any other hex.
2. Apply it with the Management API, `PATCH /v1/projects/{ref}/config/auth` with the field set to
   the file's contents, for the project named in `supabase/config.toml`. Or paste it into the
   dashboard, Authentication, Emails.
3. Read the auth config back and compare each field with its file.

The logo they load, `public/email/legibility-logo.png`, is generated by
`scripts/build-brand-assets.ts` on the same cream as the emails. Deploy a logo change before the
templates that depend on it.

### Read the North Star number

`/dashboard/metrics` leads with it. In SQL, as the service role:
`select count(*) from northstar_weekly_keys();` for this ISO week, or pass any date in an earlier
week. Internal accounts are already left out. The result goes on the first line under "Where it is
right now" in `NOW.md`.

## On-call

v1 default: the founder is on call. `/api/health`, the `ops_daily` / `ops_alerts` tables, Vercel
logs, and Supabase logs are the sources of truth until a status page exists.

## Observability

- **Health:** `/api/health` (worker reachability, billing and x402 configured).
- **North Star + monitoring:** `northstar_weekly_keys` (the North Star number: external keys with
  a trusted read this ISO week), `northstar_weekly` (weekly trusted reads per account),
  `trust_rate_by_method` (gate-pass rate by method, distinct from the golden precision metric),
  `golden_eval_runs` (precision at gate recorded pre-release), `ops_daily` / `ops_alerts`, and the
  admin metrics page `/dashboard/metrics`.
- **Vercel:** function logs and build logs for the app and the worker.
- **Supabase:** Postgres, PostgREST, and auth logs; `audit_log` table for sensitive actions.
- **Product analytics:** Google Analytics 4 and PostHog are wired on every page
  (`src/lib/analytics.ts`, `src/lib/google-tag.ts`). `trackGrowth` sends `generate_lead`,
  `sign_up` and `test_run` with the invitation id and channel label only. Marking those three as
  key events is done in the GA admin. They are cross-checks; the export never reads them.

## Backups

Supabase manages Postgres backups. The `product_cache` is rebuildable from source and is not in the
disaster-recovery critical path. Do a restore drill before GA.

## Secret rotation

Full procedure and the current founder queue live in `docs/security-rotation.md`. In short:

- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`: rotate the webhook secret every 90 days; delete
  and replace the secret key now (the beta `sk_live` keys were pasted in chat and are exposed).
- Supabase service-role key of the old project (now CTRL's): it was exposed; resetting it is on
  the queue. The current project's key is rotated the same way: reset, update both Vercel projects,
  redeploy.
- `LEGIBILITY_EXTRACTOR_TOKEN`: rotate on suspected exposure; set on the worker first, then the
  app, so the fail-closed sequence never opens a gap.
- `GROWTH_EXPORT_TOKEN_SHA256`: replace the hash and the engine's token in the same step (see
  "Growth export token" above).
- `EXPORT_ID_KEY`: only with Krish's yes; it changes every export id and resets per-IP limits.
- `TURNSTILE_SECRET_KEY`: rotate in Cloudflare, set the new secret in Vercel, redeploy. Runs are
  refused in between, which is the intended failure.
- `X402_RECIPIENT`: only changes if the payee wallet changes.
- Customer API keys: customer-driven; admin can force-revoke.
- CI (gitleaks) blocks any secret from being committed in the first place.

---

Last reviewed: 2026-10-27.
