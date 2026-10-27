# Contributing

This is an internal contributor guide for humans and AI agents working on
Legibility.

Legibility is two repos. This one is the app (public site, dashboard, REST +
MCP surface, billing, metering). The extraction engine, the confidence
scorer, the is-product verifier, calibration, and the eval harness live in a
separate repo, `legibility-worker`. The app proxies `read_product` and
`resolve_product` to the worker; correctness lives in the worker.

## Branching

Real git. Never push to `main` directly: branch, open a PR, get green CI,
squash-merge, then sync. Vercel auto-deploys `main` and builds a preview for
every PR. End commit messages with the `Co-Authored-By` trailer.

## Commit style

- Imperative subject, 60 chars or fewer: "Add the errors docs page".
- Body: what and why, not how.
- One concern per commit when possible.

## Plan vs build mode

- **Plan mode** for anything with multiple files, schema changes, or
  cross-role impact (for example brand + docs + copy).
- **Build mode** for narrow, well-scoped edits.

## Where to put things

| Adding...                            | Goes in                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A public page                        | `src/routes/<name>.tsx`                                                                                                                                                      |
| A docs page                          | `src/routes/docs.<name>.tsx` + sidebar link                                                                                                                                  |
| A dashboard page                     | `src/routes/_authenticated/dashboard.<name>.tsx`                                                                                                                             |
| A REST endpoint                      | `src/routes/api/v1/<name>.ts`                                                                                                                                                |
| An inbound provider webhook receiver | `src/routes/api/<provider>/<name>.ts` (for example `api/stripe/webhook.ts`). Legibility receives provider webhooks; it does NOT send outbound webhooks to customers.         |
| A client-callable server function    | `src/lib/api/<area>.functions.ts`                                                                                                                                            |
| A server-only helper                 | `src/lib/api/<area>.server.ts` or `src/integrations/...server.ts`                                                                                                            |
| A migration                          | Write the SQL in `supabase/migrations/`, test it in PGlite (`src/test/db/`), apply it to the project named in `supabase/config.toml`, and only then merge code that reads it |
| An image / font / binary asset       | `src/assets/` or `public/`                                                                                                                                                   |
| Engine, scorer, calibration, eval    | the `legibility-worker` repo, not here                                                                                                                                       |

## The eval harness (the engine's ground truth)

The engine's correctness is not a matter of opinion. It is measured against
a labelled golden set on every change, in the `legibility-worker` repo.

- `worker/test/golden-set.json` is the labelled truth set (316 rows). Each
  row is a reference (URL / GTIN / name), the expected object, and an
  `is_product` boolean (a real product versus a 404, a block page, a
  homepage redirect, or an adversarial non-product).
- `worker/test/eval.ts` runs every row through the engine and reports the
  numbers that matter: precision at the 0.7 gate (with a Wilson lower
  bound), adversarial rejection rate, GTIN recall, and crash count. The gate
  is only allowed to move when this harness says it should.
- Held-out test-split baseline to protect: precision at gate 1.0 (Wilson low
  0.832), adversarial rejection 1.0, GTIN recall 1.0, zero crashes. A change
  that drops any of these is not shippable.

Run the harness before and after any change to the scorer (`confidence.ts`),
the is-product verifier (`isproduct.ts`), the extractor (`extract.ts`), or
name resolve (`resolve.ts`). A scorer change with no eval run is not
reviewable.

## Calibration

`confidence` is a calibrated probability, not a raw score, so 0.7 literally
means "about 70 percent likely to be correct."

- `fit-calibration.ts` fits the isotonic mapping from raw scores to
  calibrated probabilities against the golden set.
- `worker/src/calibrate.ts` applies that mapping at request time.
- `worker/calibration.json` is the fitted mapping, committed and versioned.
- Every metered call is stamped with `calibration_version`. When you refit,
  bump the version so old and new observations stay comparable. Never edit
  `calibration.json` by hand: refit it.

## CI

`.github/workflows/ci.yml` runs on every PR and on push to `main`:

1. **gitleaks** secret scan. Fails the build on any committed secret. Hard
   gate: a leaked key blocks the merge.
2. **No em dashes.** CI greps for the character across `src/`, `docs/`,
   `docs-internal/`, `public/` and the README, restricted to text files, and
   fails on any hit. House style, mechanically enforced. Use a period, comma,
   colon, or "to" for ranges.
3. **Format:** `bun run format:check`. Hard gate. Run `bun run format` to fix.
4. **Typecheck:** `bunx tsc --noEmit`. Hard gate.
5. **Lint:** `bun run lint`. Hard gate. The `continue-on-error` escape hatch was
   removed once the repo-wide prettier pass landed. Do not reintroduce it.
6. **Unit tests + coverage:** `bunx vitest run --coverage`. Hard gate. The money
   paths (`stripe-signature.ts`, `meter.ts`) are held at 100 percent line and
   branch. Those thresholds are a protected path: lowering one to make a run go
   green is a guardrail trip, not a fix. The same run includes the migration
   tests in `src/test/db/`: every file in `supabase/migrations/` applied in order
   to an in-process Postgres (PGlite) with Supabase's roles, default grants,
   `auth.users` and the `pg_cron` calls stubbed, so a migration's triggers,
   grants and week arithmetic are tested as SQL with no network or secrets.
7. **Build:** `bun run build`. Hard gate. It also rewrites `public/sitemap.xml`;
   revert that file if the only change is a date.
8. **Database checks:** `bun scripts/sync-calibration.ts --check` and
   `bun scripts/sync-plans.ts --check`. Hard gates that compare the published
   calibration figures and plan figures with the live tables. They run only
   when the `SUPABASE_SERVICE_ROLE_KEY` secret is present (skipped on forks).
9. **llms-full.txt:** `bun scripts/build-llms-full.ts --check`. Hard gate: the
   long form is generated from `public/llms.txt` and the failure-reason
   content. After editing `llms.txt`, regenerate with
   `bun scripts/build-llms-full.ts`.
10. **GEO artifacts:** `bun scripts/check-geo.ts`. Hard gate. Validates robots.txt
    group semantics, the sitemap, and that public plan claims match the JSON-LD
    offers.

Get CI green before asking for review.

## Before you ship (checklist)

- [ ] No em dashes in copy (the CI house-style step passes).
- [ ] Every new public table has GRANTs and RLS policies in the migration.
- [ ] Every authed server function chains `requireSupabaseAuth`.
- [ ] Every new route has its own `head()` with title, description, og:title, og:description.
- [ ] Public route loaders do NOT call protected server functions.
- [ ] Logo and favicon still render (smoke check at `/` and the browser tab icon).
- [ ] Engine change? The eval harness (`worker/test/eval.ts`) was re-run and
      precision, adversarial rejection, GTIN recall, and crash count did not
      regress.
- [ ] Refit calibration? `calibration_version` was bumped and
      `calibration.json` regenerated (not hand-edited).
- [ ] Any new wedge / table / surface is reflected in the matching
      `docs-internal/*.md`.
- [ ] `docs-internal/README.md` updated if a load-bearing rule changed.

## Asking the user

Use the questions tool when scope or preference is genuinely ambiguous. Do
not ask about settled defaults (Vercel hosting, the Supabase project named in
`supabase/config.toml`, the standalone `legibility-worker` extraction worker).

---

Last reviewed: 2026-10-27.
