# Secret rotation runbook (PLAN F0.2)

Standing rule: any credential that has ever appeared in a chat transcript, commit, PR body, or synced doc is EXPOSED and gets rotated. Secrets live only in Vercel env vars (sensitive), Supabase Vault, and the local gitignored `~/.claude/secrets/` files. Never inline a secret into code, a commit, or a doc.

## Current rotation queue (as of 2026-07-05, founder actions)
1. Stripe: DELETE both exposed live secret keys in the dashboard (the 2026-06-11 chat-pasted key and any other chat-pasted sk_live). Create a fresh restricted key for the app; put it in Vercel env `STRIPE_SECRET_KEY` (sensitive) only.
2. Supabase (cgkcplcamsijghalintq): reset the service-role key, then update Vercel env on BOTH projects (legibility, legibility-worker) and `~/.claude/secrets/legibility.env`.
3. Railway OAuth client secret: rotate (exposed in an earlier session).
4. Vercel + GitHub + Supabase access tokens in `~/.claude/secrets/TOKENS.md`: rotate on the TOKENS.md cadence (file is marked exposed since 2026-06-11).

## How each rotates
- Stripe: Dashboard -> Developers -> API keys. Prefer restricted keys with only the needed scopes (checkout sessions, subscriptions, billing portal, webhooks read).
- Supabase service role: Project Settings -> API -> Reset service_role. Everything using the old key 401s immediately; redeploy after env update.
- Worker token (`PLINTH_EXTRACTOR_TOKEN`): generate a new random 32+ byte token, set on both Vercel projects, redeploy both. The worker fails closed without it (F0.3), so sequence: set new on worker -> deploy worker -> set new on app -> deploy app.
- Verify after every rotation: the OLD credential must return 401 against a real endpoint; record the check in the PR or ledger.

## Enforcement
- CI runs gitleaks on every PR and push to main (`.github/workflows/ci.yml`, `secret-scan` job); a committed secret fails the build.
- Test the scanner, never with a real secret: commit a fake `sk_live_000...` on a branch and confirm CI goes red, then drop the branch.
