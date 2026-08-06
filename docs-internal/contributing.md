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

| Adding...                          | Goes in                                      |
| ---------------------------------- | -------------------------------------------- |
| A public page                      | `src/routes/<name>.tsx`                      |
| A docs page                        | `src/routes/docs.<name>.tsx` + sidebar link  |
| A dashboard page                   | `src/routes/_authenticated/dashboard.<name>.tsx` |
| A REST endpoint                    | `src/routes/api/v1/<name>.ts`                |
| An inbound provider webhook receiver | `src/routes/api/<provider>/<name>.ts` (for example `api/stripe/webhook.ts`). Legibility receives provider webhooks; it does NOT send outbound webhooks to customers. |
| A client-callable server function  | `src/lib/api/<area>.functions.ts`            |
| A server-only helper               | `src/lib/api/<area>.server.ts` or `src/integrations/...server.ts` |
| A migration                        | Supabase Management API / MCP, mirror to `supabase/migrations/` |
| An image / font / binary asset     | `src/assets/` or `public/`                   |
| Engine, scorer, calibration, eval  | the `legibility-worker` repo, not here           |

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
2. **No em dashes in `src/`.** `grep -rn "—" src/` must return nothing. House
   style, mechanically enforced. Use a period, comma, colon, or "to" for
   ranges.
3. **Typecheck:** `bunx tsc --noEmit`. Hard gate.
4. **Lint:** `bun run lint`. Currently non-blocking (`continue-on-error`)
   until the Lovable-origin files get a prettier pass. Do not add new lint
   debt behind it.
5. **Build:** `bun run build`. Hard gate.

Get CI green before asking for review.

## Before you ship (checklist)

- [ ] No em dashes in copy (`rg "—" src/` returns nothing outside JSON examples).
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
not ask about settled defaults (Vercel hosting, the `cgkc` Supabase project,
the standalone `legibility-worker` extraction worker).

---
Last reviewed: 2026-07-06.
