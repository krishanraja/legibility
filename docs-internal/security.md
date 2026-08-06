# Security

## Auth model

- Email auth via Supabase Auth (project `cgkcplcamsijghalintq`).
- Sessions managed by Supabase; never persisted server-side.
- Customer API keys: `plk_` prefix + 32 random bytes. sha256-hashed at
  rest. Shown ONCE at creation. One key per account in v1.
- Every `/api/v1/*` tool validates the `plk_` key as a Bearer token and
  returns 401 before any work when it is missing or invalid.

## Worker auth (fail closed)

- The extraction worker (`legibility-worker`) shares `PLINTH_EXTRACTOR_TOKEN`
  with the app. It refuses to serve without it: on boot, an unset token
  calls `process.exit(1)` (see `worker/src/server.ts`). Local dev must opt
  in explicitly with `LEGIBILITY_ALLOW_INSECURE_DEV=1`, never silently.
- `/extract` checks the bearer with a length-guarded constant-time compare
  (`timingSafeEqual`); a bad or absent token returns 401.
- The app fails closed too: if `PLINTH_EXTRACTOR_URL` / `PLINTH_EXTRACTOR_TOKEN`
  are unset, `read_product` returns a clean 503 (`external_worker_not_configured`)
  rather than calling out unauthenticated.

## Roles

Two roles: `user`, `admin`. Stored in `user_roles` only. Checked via
`public.has_role(_user_id, _role)` security-definer function. NEVER
store role on `profiles`.

## RLS posture

- Every public-schema table has RLS enabled and explicit GRANTs.
- Owner-scoped tables (`using (auth.uid() = user_id)`): `usage_events`,
  `api_keys`, `subscriptions`, and `outcome_reports` (own-row insert and
  select policies only).
- Admin-only reads: `using (public.has_role(auth.uid(), 'admin'))`.
- Service-role only, RLS on with NO `authenticated`/`anon` policies:
  `product_cache`, `golden_eval_runs`, `ops_daily`, `ops_alerts`. Raw
  extraction data and the monitoring rollups are never client-readable.
- The North Star / monitoring RPCs (`northstar_weekly`, `trust_rate_by_method`,
  `entitlement_check`, `compute_ops_daily`, `check_kill_floor`, `kill_dashboard`)
  are security-definer with `EXECUTE` revoked from `PUBLIC`, `anon`, and
  `authenticated`; only the service role runs them.

## Secrets handling

- Secrets are Vercel environment variables (app and worker projects), stored
  sensitive. Ops copies live in the local gitignored vault
  (`.claude/secrets/legibility.env`); never inline a secret into a commit, PR, or
  synced doc.
- Read inside server-function handlers (or dynamically imported `*.server.ts`),
  never at module scope of client-imported files.
- The Supabase service-role key is never imported at the top level of a route file.
- Full rotation procedure and the standing rule ("any credential ever seen in a
  transcript, commit, or synced doc is EXPOSED and gets rotated") live in
  `docs/security-rotation.md`.

### Exposed keys pending rotation (founder action)

These were pasted in chat during the build and are still live. They are on the
rotation queue in `docs/security-rotation.md` and are the founder's to delete:

- The chat-pasted `sk_live` Stripe secret key(s): delete in the Stripe dashboard,
  replace with a fresh restricted key.
- The `cgkcplcamsijghalintq` Supabase service-role key: reset, then update both
  Vercel projects and the local vault.

Rotate the worker token by setting the new value on the worker first, deploying,
then the app, so the fail-closed sequence never opens a gap.

## Secret scanning (CI)

- `.github/workflows/ci.yml` runs a `secret-scan` job (gitleaks) on every PR and
  every push to `main`; a committed secret fails the build.
- Test the scanner with a fake `sk_live_000...` on a throwaway branch, never a
  real secret.

## Abuse handling

- Per-key rate limit: `rateCheck` (60s window, per plan) on every `/api/v1` call;
  over-limit returns 429 with rate headers and `retry-after`.
- Monthly quota + cost fuse: `entitlement_check` runs BEFORE the worker call. Free
  accounts hard-stop at the included allowance (402 `quota_exceeded`) and trip a
  cost fuse on real spend (402 `cost_fuse`), so a non-paying account cannot run
  unbounded real-cost extractions.
- Billing unit is the trusted read: a null or low-confidence result is not billed
  and does not consume quota (`usage_events.billable = product returned AND
  confidence >= 0.7`), so abuse that only produces misses cannot cost the customer
  and is bounded by the free cost fuse.
- Takedown blocklist enforced at extraction time (see `legal-trust.md`).
- No bulk endpoints, no result pagination in v1.
- IP-level throttling of repeated unauthenticated 401s is not implemented yet
  (roadmap); today the fail-closed 401s on the app and worker are the floor.

## Dependency policy

- The app runs on Vercel Node functions, so full Node is available. Still keep
  functions lean and prefer fetch over heavy SDKs (the Stripe and x402
  integrations use plain `fetch`, not SDKs).
- `bun audit` before each release; high/critical patched the same week.
- Keep cold starts small: avoid pulling large native deps into the SSR path.

## Security memory

Live posture and ignored-finding rationale: see the project security
memory (managed via the security tool). Update both when posture
changes.

---
Last reviewed: 2026-07-06.
