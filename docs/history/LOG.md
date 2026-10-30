# History log

Newest first. Entries are written by the docs steward (see the steward link in
NOW.md) and by humans doing the same job by hand. Nothing in this file
describes current behaviour; NOW.md and the state doc do.

## 2026-10-30

- reconciled at `30c27f3`: the seven commits since `44cf0b2` were brand colours, the auth email templates and canon or harness syncs; NOW.md already carried the brand and auth-email work, so it was shortened to meet the audit (one bullet over the line limit, eleven "right now" bullets, no "Next" line) and re-stamped.
- rolled from NOW.md: **2026-10-23: magic-link sign-in works again.** The Supabase auth sender now sits on the Resend-verified domain; a sign-in request for an existing account returned 200 and the account's send time was stamped (auth config and user readback). No code changed.
- rolled from NOW.md: **2026-10-21: a readable error when the magic-link email fails** (`e62a623`). supabase-js turned a failed send into a bare "{}" toast; the cause sat in the Supabase SMTP sender.
- rolled from NOW.md: **2026-10-21: the public errors and rate-limits docs now match the API** (`346c1c3`). They promised per-day and concurrency caps, a `code` field and a 451 takedown that the API never had; both pages now render from one source checked against the routes, the plans seed and the MCP server.
- rolled from NOW.md: **2026-10-21: the answer hub and agent-first discovery** (`c9c2a54`), so an agent can find how to reach the MCP server and pay per call from search, assistants, `llms.txt`, the feed and `/.well-known/mcp.json`. The old social card still showed the dead "plinth" wordmark.
- rolled from NOW.md: **2026-10-03: TanStack Start bumped to clear an XSS advisory** that had made Vercel block every deploy (`95126cc`), and the public contact moved off the old brand's domain (`55a9ab0`).
- rolled from NOW.md: the long form of the 2026-10-28 brand bullet (design system artifact and brand book PDF, Drive copies replaced and checked by md5, the email logo on the same cream, the italic line on the social cards now `stone`).

## 2026-10-28

- reconciled at `44cf0b2`: the nine commits since `48aca05` (A1 to A8, the docs audit and its re-check) were already closed out in NOW.md by their sessions and checked against the digest; NOW.md was re-stamped (head and as_of) and nothing else changed.
- rolled from NOW.md: **2026-09-27: a Google Analytics tag on every page, beside PostHog** (`1403690`).

## 2026-10-27

- rolled from NOW.md: **2026-09-23: Legibility moved to a new database after its old one was given to another product** (`272023a`). The 18 Sep cleanup dropped its schema, users and cron and wiped the migration ledger; all 18 migrations were applied again and the calibration record was restored as a marked reconstruction, never a re-run. The same day: the cohort sweep finally writes what it reads (it had contained zero inserts, `bb892ba`), the index was published and its arithmetic tested (`10bf892`), the rename to Legibility finished on the app side (the worker had been rejecting every cache write for seven weeks, `4752215`), and a Stripe webhook still pointing at the deleted pre-revival deployment was removed (`b94fd93`).

## 2026-10-23

- reconciled at `0fac675`: three commits since `7e1f8b8` touched only harness files, workflows and `.prettierignore`; no documentation consequence, so NOW.md was re-stamped and nothing else.

## 2026-10-22

- reconciled at `7e1f8b8`: first NOW.md, written by hand at enrolment in the docs steward fleet.
