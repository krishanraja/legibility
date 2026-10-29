# History log

Newest first. Entries are written by the docs steward (see the steward link in
NOW.md) and by humans doing the same job by hand. Nothing in this file
describes current behaviour; NOW.md and the state doc do.

## 2026-10-29

- reconciled at `8e2bc61`: the six commits since `44cf0b2` (brand colours, auth emails applied to the hosted project, canon sync, harness maintenance) were closed out in NOW.md by their sessions; NOW.md was cut back to meet the audit limits (the 28 Oct bullet shortened, Drive-copy and artifact detail dropped, "Where it is right now" merged to eight bullets) and re-stamped.
- rolled from NOW.md: **2026-10-27: an independent audit of the docs, and every finding fixed.** Runbooks now point migrations at the project named in `supabase/config.toml`, never by id; the operator runbooks for the export token, the Founding 200 page, the MCP Registry, the internal list, trials and the number are in `docs-internal/ops.md`; Stripe ids, a personal address and the old project id are gone from the docs. Two small code changes came with it: the Founding 200 offer now follows the automatic-trial flag, so turning it on cannot leave the page promising Free's 1,000 reads, and `/docs/mcp` shows the real tool list, key auth and a manifest link and no longer claims a mainnet date. `/terms` now states the trial and that x402 is on testnet; `/privacy` states how long the new records are kept.

## 2026-10-28

- reconciled at `44cf0b2`: the nine commits since `48aca05` (A1 to A8, the docs audit and its re-check) were already closed out in NOW.md by their sessions and checked against the digest; NOW.md was re-stamped (head and as_of) and nothing else changed.
- rolled from NOW.md: **2026-09-27: a Google Analytics tag on every page, beside PostHog** (`1403690`).

## 2026-10-27

- rolled from NOW.md: **2026-09-23: Legibility moved to a new database after its old one was given to another product** (`272023a`). The 18 Sep cleanup dropped its schema, users and cron and wiped the migration ledger; all 18 migrations were applied again and the calibration record was restored as a marked reconstruction, never a re-run. The same day: the cohort sweep finally writes what it reads (it had contained zero inserts, `bb892ba`), the index was published and its arithmetic tested (`10bf892`), the rename to Legibility finished on the app side (the worker had been rejecting every cache write for seven weeks, `4752215`), and a Stripe webhook still pointing at the deleted pre-revival deployment was removed (`b94fd93`).

## 2026-10-23

- reconciled at `0fac675`: three commits since `7e1f8b8` touched only harness files, workflows and `.prettierignore`; no documentation consequence, so NOW.md was re-stamped and nothing else.

## 2026-10-22

- reconciled at `7e1f8b8`: first NOW.md, written by hand at enrolment in the docs steward fleet.
