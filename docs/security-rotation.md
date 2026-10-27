# Secret rotation runbook (PLAN F0.2)

Standing rule: any credential that has ever appeared in a chat transcript, commit, PR body, or synced doc is EXPOSED and gets rotated. Secrets live only in Vercel env vars (sensitive), Supabase Vault, and the local gitignored `~/.claude/secrets/` files. Never inline a secret into code, a commit, or a doc.

## Current rotation queue (as of 2026-07-05, founder actions)

1. Stripe: DELETE both exposed live secret keys in the dashboard (the 2026-06-11 chat-pasted key and any other chat-pasted sk_live). Create a fresh restricted key for the app; put it in Vercel env `STRIPE_SECRET_KEY` (sensitive) only.
2. Supabase, the old project (used until 2026-09-23, now CTRL's): reset the exposed service-role key. Legibility no longer uses that project; its own project is the one named in `supabase/config.toml`, rotated the same way (reset, then update Vercel env on BOTH projects, legibility and legibility-worker, and `~/.claude/secrets/legibility.env`).
3. Railway OAuth client secret: rotate (exposed in an earlier session).
4. Vercel + GitHub + Supabase access tokens in `~/.claude/secrets/TOKENS.md`: rotate on the TOKENS.md cadence (file is marked exposed since 2026-06-11).

## How each rotates

- Stripe: Dashboard -> Developers -> API keys. Prefer restricted keys with only the needed scopes (checkout sessions, subscriptions, billing portal, webhooks read).
- Supabase service role: Project Settings -> API -> Reset service_role. Everything using the old key 401s immediately; redeploy after env update.
- Worker token (`LEGIBILITY_EXTRACTOR_TOKEN` on the app): generate a new random 32+ byte token, set on both Vercel projects, redeploy both. The worker fails closed without it (F0.3), so sequence: set new on worker -> deploy worker -> set new on app -> deploy app.
- Growth export token (`GROWTH_EXPORT_TOKEN_SHA256` holds its hash): today the token is the growth engine's Control Center bearer, so rotating that bearer needs the hash here replaced in the same step. Generate a dedicated token, set its lowercase hex SHA-256 in Vercel Production, redeploy, and give the token to growth-legibility as `LEGIBILITY_EXPORT_TOKEN` (full steps: `docs-internal/ops.md`, "Growth export token").
- `EXPORT_ID_KEY`: rotate only with Krish's yes. It changes every opaque id the growth engine holds and resets the Founding 200 per-IP limits.
- `TURNSTILE_SECRET_KEY`: rotate in Cloudflare, set in Vercel, redeploy. Founding 200 runs are refused in between (fail closed).
- `MCP_REGISTRY_AUTH_PUBLIC_KEY` is a public key, not a secret; replacing it means a new publishing key pair.
- Verify after every rotation: the OLD credential must return 401 against a real endpoint; record the check in the PR or ledger.

## Enforcement

- CI runs gitleaks on every PR and push to main (`.github/workflows/ci.yml`, `secret-scan` job); a committed secret fails the build.
- Test the scanner, never with a real secret: commit a fake `sk_live_000...` on a branch and confirm CI goes red, then drop the branch.
