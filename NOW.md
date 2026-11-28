---
repo: krishanraja/legibility
product: Legibility
as_of: 2026-11-28
head: ec09b87
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

## Where it is right now (as of 2026-11-28)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 1, "current": 0, "current_as_of": "2026-10-27", "current_source": "northstar_weekly_keys() on the production database, internal accounts excluded (migration 20261027120000 applied 2026-10-27)", "urgency": 4, "urgency_reason": "0 against 1 this week, under 40%"} --> **North Star number: U4, far behind.** Production agents making trusted reads this week: 0 against 1 this week (measured 27 Oct with `northstar_weekly_keys`, internal accounts excluded), on the way to 1,000 by 29 March 2027. A bold swing every day; work that does not move the number waits.

Lifecycle: beta. `README.md` says "Status: live" and "Private beta": the app serves at legibility.io, but no card payment can complete and x402 runs on testnet only.

Live and recorded as verified:

- All four tools, key auth, trusted-read metering, per-plan quota, the dashboard, Stripe checkout wiring and the MCP server at `/api/mcp` (`README.md`).
- The free domain check, the cohort index and the `/why` pages; the index reads one row per domain, newest reading each, since `10bf892`. The weekly sweep runs on a GitHub runner on Mondays (`.github/workflows/sweep.yml`); its last recorded run, on 19 Oct, succeeded (GitHub Actions readback, 22 Oct).
- The answer hub at `/answers` (`docs/ANSWER-HUB.md`), and the public errors and rate-limits pages, which render from `src/content/api-reference.ts` and are checked by tests against the code (`346c1c3`).
- Magic-link sign-in sends again (Supabase auth readback, 23 Oct). CI on `main` passed on 27 Oct (#52, GitHub Actions readback).

Built but not live:

- x402 settles on Base Sepolia only; the flow reaches the facilitator and returns `insufficient_balance`, so only a funded buyer wallet is missing (`docs/OUTSTANDING.md`).
- Metered overage is measured but not reported to Stripe (`README.md`, "Billing"); the Bright Data unblocker is built and deliberately off (`README.md`, "Honest scope").

Broken, blocked or waiting:

- **No checkout can complete.** The live Stripe account reports card payments inactive, which only Stripe onboarding can clear (`docs/OUTSTANDING.md`; `8a9e7ea`).
- Fuzzy-name resolve needs Exa credits; exposed secrets still wait to be rotated (`docs/OUTSTANDING.md`, "Founder actions").

## What changed recently

- **2026-11-15: Fincept Terminal evaluated, none of it integrated, one real defect fixed.** Fincept (AGPL-3.0-or-later, C++/Qt desktop with Python connectors) was assessed for Legibility and none of it was integrated: it is market and macro data, outside product data for agents, and copying its code into this network service would put the app under AGPL. The evaluation found one real defect in compare_products, fixed and live: price_delta no longer computes a spread across currencies (USD 110 against GBP 66 used to return a spread of 44 "USD"); it returns null with price_delta_reason "mixed_currencies", and same-currency output is unchanged (`f47e333`, PR 67; production deploy READY by Vercel API readback, 15 Nov). Cross-currency conversion is deliberately not built; if Krish wants it, it reads ECB reference rates directly, never Fincept code.
- **2026-11-20: a page-reading key (Firecrawl) and a web-search key (Parallel) were added to the edge function secrets of the Supabase project this app runs on.** Checked by name only, no value read; nothing uses them yet and no spend has happened. They are readable only from that project's edge functions, not from GitHub Actions, a Vercel function or Python unless mirrored, which is a secret write and needs Krish's approval first. The real extraction lives in `legibility-worker`, so any page-reading fallback belongs there, measured against the worker's own extractor on a sample first, with the 100 percent coverage rule kept for anything added under `src/lib/api` (`5cf64af`; closeout note `now-notes/2026-11-20-firecrawl-parallel-keys.md`, which the fold rejected as malformed and which waits for a person).

## What is next and what is waiting on Krish

- Next: create the Turnstile keys so the Founding 200 page opens (`docs-internal/ops.md`, "Open the Founding 200 page"); it is the path to the first external key this week.
- Create the MCP Registry publishing key, publish `server.json`, and submit the directory listings (the 5 November date has passed; whether it was met is unverified) (`docs-internal/ops.md`, "Publish to the MCP Registry").
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
- North Star check (2026-11-20): holds, no movement.

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
