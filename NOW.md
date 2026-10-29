---
repo: krishanraja/legibility
product: Legibility
as_of: 2026-10-29
head: 8e2bc61
lifecycle: beta
production_url: https://legibility.io
state_doc: docs/OUTSTANDING.md
history_log: docs/history/LOG.md
truth_files: []
# prettier-ignore
authority_order: [docs/NORTH_STAR.md, public/llms.txt, public/llms-full.txt, README.md, docs-internal/README.md, docs/KILL-CRITERIA.md, docs/OUTSTANDING.md]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
# prettier-ignore
never_publish: [any credential or the name of any secret, the Supabase project ids old and new, the Stripe account id and webhook endpoint ids, the Vercel protection bypass secret, any buyer wallet address, the auth email sender address, any named design partner or prospect]
---

# Legibility: where it is right now

## What it is

Legibility measures whether a machine can read a website, and records why when it cannot (`public/llms.txt`). It offers a free check of any one domain at legibility.io, publishes an index over a fixed cohort of twenty well-known retail and news sites at `/readability`, and explains each of the closed set of reasons a page can fail at `/why`. The same reading engine is sold as typed product data for software agents: one call turns a product URL, a GTIN barcode or a fuzzy product name into a typed product with per-field confidence, a price band and the per-call cost in the response, over REST and MCP, paid with an API key or per call in USDC over x402 (`README.md`). This repository is the TanStack Start app on Vercel with a Supabase data layer; the extraction runs in the separate `krishanraja/legibility-worker` deploy (`README.md`, "Architecture"). Legibility is a Mindmaker LLC company (`a7709ac`).

## Who it is for and why it matters for Mindmake

Two buyers, per the repo. The front page is "written for a commercial buyer, not a developer": the commercial owner of a catalogue whose site AI assistants cannot read, so the assistant answers from a marketplace or a competitor and the brand never sees the visit (`docs/gtm/README.md`; `public/llms.txt`). The API is for developers building agents that need product facts they can gate on (`README.md`). The North Star is about the second: agents paying per call on mainnet (`docs/NORTH_STAR.md`).

What it proves for Mindmake: Krish sees a shift (assistants reading pages instead of people) and makes it measurable while it still counts, with every published figure carrying its method and its limits. Angles a writer can use:

- **A number on the page can only be one that was measured.** The calibration figures (n=63, precision 1.0 at the 0.7 gate, Wilson lower bound 0.832) are read from `src/data/calibration.json`, which is generated from stored evaluation runs, and CI fails if the two disagree (`272023a`; `public/llms.txt`).
- **The commit log is the decision record, corrections included.** A commit quoted the wrong split of the cohort; the next commit corrected it, because "the error is confined to the commit message, which in this repo is the decision record" (`b138f35`).
- **Gates that never fired.** Two database checks in CI had been written, reviewed and merged and had never run, because of a scoping mistake in their condition. "A gate that cannot fail is not a gate" (`f9dbcf7`).
- **The terms stopped promising an invoice nobody sends** (`29b248b`).

Objection it answers: "AI product data is guesswork." Legibility returns `product: null` at low confidence rather than a guess, and a null read costs the caller nothing (`README.md`, "Honest scope" and "Billing").

## Where it is right now (as of 2026-10-29)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 1, "current": 0, "current_as_of": "2026-10-27", "current_source": "northstar_weekly_keys() on the production database, internal accounts excluded (migration 20261027120000 applied 2026-10-27)", "urgency": 4, "urgency_reason": "0 against 1 this week, under 40%"} --> **North Star number: U4, far behind.** Production agents making trusted reads this week: 0 against 1 this week (measured 27 Oct with `northstar_weekly_keys`, internal accounts excluded), on the way to 1,000 by 29 March 2027. A bold swing every day; work that does not move the number waits.

Lifecycle: beta. `README.md` says "Status: live" and "Private beta": the app serves at legibility.io, but no card payment can complete and x402 runs on testnet only.

Live and recorded as verified:

- All four tools, key auth, trusted-read metering, per-plan quota, the dashboard, Stripe checkout wiring and the MCP server at `/api/mcp` (`README.md`).
- The free domain check, the cohort index and the `/why` pages; the index reads one row per domain, newest reading each, since `10bf892` (23 Sep). The weekly sweep runs on a GitHub runner on Mondays (`.github/workflows/sweep.yml`; `c4c436a`); its last recorded run, on 19 Oct, succeeded (GitHub Actions readback, 22 Oct).
- The answer hub at `/answers` (five seed posts, an RSS feed, a weekly brief workflow that spends nothing on models; `c9c2a54`; `docs/ANSWER-HUB.md`), and the public errors and rate-limits pages, rendered from `src/content/api-reference.ts` and checked by tests against the code (`346c1c3`).
- Magic-link sign-in sends again: the auth sender is on the Resend-verified domain, and a sign-in request for an existing account on 23 Oct returned 200 and stamped its send time (Supabase auth readback, 23 Oct). The four auth emails in `supabase/templates/` are applied to the hosted project, read back byte for byte on 28 Oct.

Built but not live:

- x402 settles on Base Sepolia only; the flow reaches the facilitator and returns `insufficient_balance`, so only a funded buyer wallet is missing (`docs/OUTSTANDING.md`).
- Metered overage is measured but not reported to Stripe (`README.md`, "Billing"; `29b248b`). The Bright Data unblocker is built and deliberately off (`README.md`, "Honest scope").

Broken, blocked or waiting:

- **No checkout can complete.** The live Stripe account reports card payments inactive, which only Stripe onboarding can clear (`docs/OUTSTANDING.md`; `8a9e7ea`).
- Fuzzy-name resolve needs Exa credits; exposed secrets still wait to be rotated (`docs/OUTSTANDING.md`, "Founder actions").

## What changed recently

- **2026-10-28: a design system and a brand book, extracted from the code.** Every hard-coded copy of a brand colour had drifted to an approximation (navy #0E1B2C for a token that renders #071725); the comments in `src/styles.css`, the favicon set, the app icons, both social cards, the manifest and the theme-color meta now use the token renders, regenerated by `scripts/build-brand-assets.ts`, and `src/test/brand-colours.test.ts` fails if a token moves without them. The four branded auth emails moved to the token colours too, and live in `supabase/templates/`, byte for byte what Supabase sends. Krish approved applying them to the hosted project on 28 Oct; they replaced the old approximations and 15px semibold button, and a readback of the auth config matched each file byte for byte, with the subjects and every other auth setting unchanged (`docs-internal/ops.md`, "Change the auth emails"). Four of the brand's own pairs miss 4.5:1 for small text (signal on cream and cream on signal at 3.93:1 in light, stone, destructive on dark); they are kept exact and flagged in the design system.
- **2026-10-27: the growth engine's app contract, A1 to A8 (growth-legibility `docs/handoff/APP-PHASE-1.md`), built in seven pull requests.** Where each stands:
  - **A1, the internal list and `northstar_weekly_keys`: live** (PR 45, migration `20261027120000` applied). Krish's account is on the list; the number is measured per ISO week and external key (0 this week).
  - **A2, attribution capture: live** (PR 46, `20261027130000` applied). Landing touch in a 30-day first-party cookie, enrolment and key touches, first client, GA4 and PostHog `generate_lead` and `sign_up`. `test_run` follows from A3. Waiting on Krish: mark those three as key events in GA admin.
  - **A4, the row-level export: live** (PR 47, `20261027140000` applied). `GET /api/internal/growth/export`; the token is held only as its hash and the ids are keyed, and both are set. The token is today the growth engine's Control Center bearer, so rotating that bearer breaks the export until a dedicated token replaces it (`docs-internal/ops.md`). Events coverage stays false until bounces, complaints, unsubscribes and referrals are recorded; no `trial_granted` or `trial_ended` event is emitted.
  - **A6 and A7, role contact, tool metadata and `server.json`: live** (PR 48, no migration). Waiting on Krish: create his registry publishing key, publish `server.json` and submit the directory listings by 5 November (steps in `docs-internal/ops.md`).
  - **A3, the run-first Founding 200 page: merged** (PR 49, `20261027150000` applied), **paused** until Krish creates the Turnstile keys (steps in `docs-internal/ops.md`). His approval of its words and limits is recorded in that PR. `public/llms.txt` leaves the page out until it opens.
  - **A5, x402 calls logged: live** (PR 50, `20261027160000` applied). Settlements are vouched for from capture start; move `capture_sources` earlier only with on-chain evidence.
  - **A8, the 30-day trial: live** (PR 51, `20261027170000` applied). Shipped with the proposed defaults (5,000 reads, the clock from the grant, Free from day 30, automatic Founding 200 trials off) under the go-ahead for every app deploy in the A1 to A8 brief. A paid plan wins, a live grant serves up to its allowance and its own measured fuse, otherwise Free decides, so a trial is never worse than Free; the 402 says the trial is used up and nothing was charged. Grants are Krish's click on `/dashboard/waitlist`, Trials. Nothing touches Stripe.
- 2026-10-23 **The North Star now has a number, a weekly ladder and an urgency rating, so every session knows how far behind it is and how hard to push.** Ruling (Krish, 2026-10-23): every repository chases one aggressive number on a weekly ladder, and urgency U1 to U5 sets its intensity. The number and ladder are in `docs/NORTH_STAR.md`; where it stands is the first line under "Where it is right now". Contract: ai-harness `contract/north-star-metric.md`.
- **2026-10-23: magic-link sign-in works again.** The Supabase auth sender now sits on the Resend-verified domain; a sign-in request for an existing account returned 200 and the account's send time was stamped (auth config and user readback). No code changed.
- **2026-10-21: a readable error when the magic-link email fails** (`e62a623`). supabase-js turned a failed send into a bare "{}" toast. The cause sits outside the code, in the Supabase SMTP sender, and is still open.
- **2026-10-21: the public errors and rate-limits docs now match the API** (`346c1c3`). They promised per-day and concurrency caps, a `code` field and a 451 takedown that the API never had. Both pages now render from one source checked both ways against the routes, the plans seed and the MCP server; putting back three of the old claims fails 3 of the 5 tests.
- **2026-10-21: the answer hub and agent-first discovery** (`c9c2a54`), for the North Star: an agent, or the developer building one, can find how to reach the MCP server and pay per call from search, assistants, `llms.txt`, the feed and `/.well-known/mcp.json`. The old social card still showed the dead "plinth" wordmark.
- **2026-10-19: Mindmaker LLC and Mindmaker Ltd named in the footer, terms and privacy** (`a7709ac`; ruling in the commit).
- **2026-10-18: the North Star was set** (`abd91f7`, `f3c6b77`): by March 2027, more revenue from agents paying per call in USDC on mainnet than from human sign-ups, with a hundred production agents depending on it every week.
- **2026-10-03: TanStack Start bumped to clear an XSS advisory** that had made Vercel block every deploy (`95126cc`), and the public contact moved off the old brand's domain (`55a9ab0`); it is now a role address on legibility.io.

## What is next and what is waiting on Krish

- Next: create the Turnstile keys so the Founding 200 page opens (`docs-internal/ops.md`, "Open the Founding 200 page"); it is the path to the first external key this week.
- Create the MCP Registry publishing key, publish `server.json`, and submit the directory listings by 5 November (`docs-internal/ops.md`, "Publish to the MCP Registry").
- Give the growth export a dedicated token, so rotating the engine's Control Center bearer cannot break it (`docs-internal/ops.md`, "Growth export token").
- Mark `generate_lead`, `sign_up` and `test_run` as key events in Google Analytics admin.
- Confirm or change A8's defaults (5,000 reads, the clock from the grant, Free from day 30, automatic Founding 200 trials off).
- Add the growth engine, CI, demo and smoke accounts to the internal list as each is created (`/dashboard/metrics`); today it holds only his own.
- Proposed for Krish, since only he edits `docs/NORTH_STAR.md`: its line "Its weekly measure stays the trusted-reads North Star metric in `docs/KILL-CRITERIA.md`" should cite `northstar_weekly_keys()`, which is what the number counts; the metric in `docs/KILL-CRITERIA.md` is now named the kill metric, a looser per-account measure.
- Activate card payments on the live Stripe account (only Stripe onboarding can clear it), then allow the live canary that closes the last billing gaps and turns on metered overage (`docs/OUTSTANDING.md`).
- Rotate the exposed secrets named in `docs/OUTSTANDING.md` and `docs/security-rotation.md`.
- Drip a little Base Sepolia USDC to a buyer wallet for the first on-chain `200` (`docs/OUTSTANDING.md`, "optional / verification"); mainnet settlement is what the North Star needs.
- Fund Exa for fuzzy-name resolve; decide on a Bright Data payment method and zone; line up 2 to 3 design partners; counsel review of `/terms` and `/privacy`; the paid GA decision (`docs/OUTSTANDING.md`).
- Rewriting the GTM playbook for the new buyer is "a commercial judgement about who this is sold to" and waits on Krish (`docs/gtm/README.md`).
- Add the GitHub Actions secret for the Vercel protection bypass (`docs/OUTSTANDING.md`).
- North Star check (2026-10-28): holds.

## Read next

1. `docs/NORTH_STAR.md`: the ambition, read every session. Only Krish changes it.
2. `public/llms.txt` and `public/llms-full.txt`: the current, CI-gated statements of what exists; where `docs/gtm/` disagrees with them, they win (`docs/gtm/README.md`).
3. `README.md`: the developer front door: tools, auth, billing and honest scope.
4. `docs-internal/README.md`: the routing table to the role docs (engineering, data model, API, billing, ops, security, legal).
5. `docs/KILL-CRITERIA.md`: the weekly North Star metric and the kill floor.
6. `docs/OUTSTANDING.md`: what still needs a human action.
7. `docs/ANSWER-HUB.md`: how the answer hub is written and kept.

## Do not trust

- `docs/gtm/`: superseded in part on its own banner (written 2026-07-06 for the developer buyer); its audience and messaging are history. The banner's line that the cohort index "has never been run" was overtaken on 2026-09-23 (`bb892ba`).
- `docs/AUDIT-2026-08-06.md`, `docs/AUTONOMOUS-HARDENING-PLAN.md` and `docs/PHASE-0-RECONCILIATION.md`: point-in-time records from 2026-08-06, written before the database move and the repositioning; current state is in `README.md` and `docs/OUTSTANDING.md`.
- `docs/security-rotation.md`'s queue "as of 2026-07-05": the open rotation is tracked in `docs/OUTSTANDING.md`.
- Comments in the applied migrations under `supabase/migrations/` still name the old Supabase project; they are history and are not edited once applied. Apply new migrations only to the project named in `supabase/config.toml`.
- The worker's own variable names (for example its LLM verifier flag) are quoted in the docs as the worker repository had them and are not checked here.
