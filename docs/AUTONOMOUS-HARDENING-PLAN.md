# Autonomous hardening plan: getting to 10/10

**Goal:** turn "10/10" from a judgement call into a set of machine-checkable gates, then let an
agent drive the repo to green with minimal human input.

**Written:** 2026-08-06, against the audit in `docs/AUDIT-2026-08-06.md`.

---

## 1. The core problem with autonomy here

An agent cannot safely fix what it cannot verify. Today this repo has **no way for any agent to
know whether it broke something**: no tests, lint is non-blocking, and CI does not even run on
working branches.

There is a second, environment-specific problem. In the Claude Code container, `bun install`
fails intermittently with `ConnectionClosed`, so **local verification is unreliable**, and
Playwright cannot reach the live site through the proxy. Any plan that depends on verifying
locally will stall.

**Both problems have the same solution: make GitHub Actions the verification substrate.** CI has
clean network, runs the real install, and gets a Vercel preview deployment per PR to test
against. The agent's job becomes: change code, push, read the CI verdict, react.

### The loop

```
                   ┌──────────────────────────────────────┐
                   │  agent pushes a commit to the branch │
                   └──────────────────┬───────────────────┘
                                      v
                   ┌──────────────────────────────────────┐
                   │  CI runs the scorecard (section 2)   │
                   │  Vercel builds a preview deployment  │
                   └──────────────────┬───────────────────┘
                                      v
                     green ◄──────────┴──────────► red
                       │                            │
            all gates pass, stop           PR activity event wakes
            and report                     the session automatically
                                                    │
                                           read failing job logs
                                           diagnose, fix, push
                                                    │
                                                    └──► loop
```

This is **event-driven, not polling**. `subscribe_pr_activity` delivers CI failures into the
session as they happen, so there is no timer to tune and no wasted wake-ups. A scheduled
check-in every ~60 minutes acts as a backstop, because webhook delivery is best-effort and CI
success notifications in particular can be missed.

**Everything runs against a PR and its Vercel preview. Production is never the test target.**

---

## 2. The scorecard: what 10/10 actually means

Every gate below is a command that exits 0 or non-zero. That is the whole definition. No gate is
subjective.

### Tier 1: correctness (blocking from Phase 0)

| Gate                  | Command                 | Threshold                                                            |
| --------------------- | ----------------------- | -------------------------------------------------------------------- |
| Typecheck             | `tsc --noEmit`          | 0 errors                                                             |
| Lint                  | `eslint .`              | 0 errors, **blocking**                                               |
| Format                | `prettier --check .`    | clean                                                                |
| Unit tests            | `vitest run`            | 100 percent pass                                                     |
| Coverage, money paths | `vitest run --coverage` | **100 percent** line and branch on the files in section 4.1          |
| Coverage, global      | same                    | ratchet at measured actuals, currently 100 on the money-path include |
| Build                 | `vite build`            | success                                                              |
| Secrets               | `gitleaks`              | 0 findings                                                           |
| House style           | em dash scan            | 0 across `src/`, `docs/`, `public/`, `README.md`                     |
| Database              | Supabase advisors       | 0 at ERROR or WARN                                                   |

### Tier 2: the live surface (blocking from Phase 3)

| Gate          | Tool                         | Threshold                                                                                                                              |
| ------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| E2E flows     | Playwright vs preview URL    | all pass                                                                                                                               |
| Accessibility | axe-core on 6 routes         | 0 serious, 0 critical                                                                                                                  |
| Lighthouse    | mobile, preview URL          | perf 90+, a11y 100, best practices 95+, SEO 100                                                                                        |
| Broken links  | linkinator on the built site | 0 broken                                                                                                                               |
| GEO validity  | custom (section 4.4)         | robots parses and excludes `/dashboard` for **every** agent group; every sitemap URL returns 200; `llms.txt` claims match the database |

### Tier 3: informational, reported not enforced

Bundle size budget, dependency vulnerability audit, unused-index report.

**Definition of done: Tier 1 and Tier 2 green on a PR, for three consecutive runs.** Three,
because a single green run can hide flakiness, and a flaky suite destroys the value of the whole
loop.

---

## 3. Phase 0: bootstrap the substrate

**Nothing else can start until this is done, because until CI is trustworthy the agent is
working blind.** One session, no product code.

1. **Open the PR** from `claude/new-session-f66hba` to `main`. This alone makes CI run for the
   first time on 74 changed files plus this pass. Expect it to fail. That failure is the first
   real signal the repo has produced.
2. **Fix whatever that first run surfaces.** Most likely the typecheck that has never run on the
   rebrand.
3. **Add vitest.** `vitest`, `@vitest/coverage-v8`, `@testing-library/react`,
   `@testing-library/jest-dom`, `msw`, `jsdom`. Vite 8 is already present so vitest shares the
   existing config; no second build system, which respects the no-fifth-thing rule.
4. **Add `test`, `test:watch` and `test:coverage` scripts.**
5. **Make lint blocking.** Delete `continue-on-error: true`. This will fail until step 6.
6. **Run `bun run format`** as its own commit, so 45 files of formatting churn never mixes with a
   behavioural diff.
7. **Extend the em dash check** to `docs/`, `public/` and `README.md`, and scope it to text files
   so it stops recursing into PNGs and `routeTree.gen.ts`.
8. **Add the scorecard workflow** with all Tier 1 gates wired, coverage thresholds set to current
   actuals so it passes, then ratcheted upward in later phases.

9. **Subscribe to PR activity** so CI failures wake the session.

**A note on the global coverage number.** The plan originally wrote this as a flat 70 percent.
That was wrong as a Phase 0 target: the repo started at zero tests, so a 70 percent gate would
have failed every run until Phase 2 finished, which makes the gate noise rather than signal. What
is implemented is a **ratchet pinned at the measured actuals**, so coverage can rise and never
fall, and the number moves up as each phase lands. The 100 percent money-path thresholds are
absolute and are not subject to this.

**Exit criterion:** a push to the branch produces a CI verdict the agent can trust, and a red
verdict wakes the session automatically.

---

## 4. The work, in dependency order

### 4.1 Money paths (Phase 1, highest value)

These are pure or near-pure functions that decide what a customer is charged and who gets in.
They are cheap to test and they are what an enterprise reviewer asks about first. **100 percent
line and branch coverage required.**

| Target                  | File                                           | Cases that must exist                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe signature verify | `src/routes/api/stripe/webhook.ts`             | valid signature; wrong signature; missing header; malformed header; timestamp outside the 300s replay window; timestamp in the future; empty body                                                        |
| Billing stamp           | `src/lib/api/meter.ts`                         | confidence exactly 0.7 is billable; 0.6999 is not; `product: null` is not; non-JSON body; missing `confidence`; domain derivation for url, gtin and name; `envelope_hash` stability for identical bodies |
| Key auth                | `src/integrations/supabase/api-keys.server.ts` | wrong prefix rejected; revoked key rejected; unknown hash rejected; valid key returns userId and keyId; `hashKey` is stable sha256                                                                       |
| Webhook handlers        | `src/routes/api/stripe/webhook.ts`             | the three failure modes fixed this pass: DB error returns 500; a failed `plans` lookup does not downgrade to free; a silent `{error}` result is surfaced                                                 |
| MCP protocol            | `src/routes/api/mcp.ts`                        | `initialize` shape; `tools/list`; `tools/call` with no auth returns 402 with payment requirements; unknown method returns -32601; `GET` returns 405                                                      |
| x402                    | `src/lib/api/x402.server.ts`                   | `paymentRequirements()` shape; zero-address recipient means unconfigured                                                                                                                                 |

**One refactor required:** `verifySignature` is module-private. Export it (or move it to
`src/lib/api/stripe-signature.ts`) so it can be tested directly. That is the only production
change this phase should make.

### 4.2 Route integration (Phase 2)

Mock Supabase and the worker with `msw`. Assert the full chain for each of the four tools:
503 when unconfigured, 401 without a key, 429 on rate limit, 402 on entitlement, 422 on bad
input, 200 with a metered row on success, and **a metered row with `billable=false` on a null
read**. That last one is the behaviour the whole panel thesis depends on.

Raise global coverage to 80 percent here.

### 4.3 Live surface (Phase 3)

Runs against the **Vercel preview URL** for the PR, which CI exposes as an output. Never prod.

- **Playwright:** homepage renders, docs navigate, magic-link sign-in form validates, dashboard
  redirects when signed out, `/api/health` returns ok.
- **axe-core** on `/`, `/docs`, `/docs/quickstart`, `/terms`, `/privacy`, `/takedown`.
- **Lighthouse CI** with the budgets in section 2. This is where the 1.55s TTFB gets a number
  attached and either improves or is accepted explicitly.

Note: Playwright cannot reach the site from the Claude Code container through the proxy. It works
fine in CI. This phase is CI-only by necessity, which is another reason the substrate has to come
first.

### 4.4 Truth tests (Phase 3, and the most valuable novel idea here)

**The recurring defect in this repo is not broken code. It is public claims that stopped being
true.** The Custom plan that does not exist, the SLA that does not exist, Nike listed as blocking
when it serves clean JSON-LD, `legibility.sh`, "DNS propagating" for a month after it propagated.
Every one of those shipped because nothing checks prose against reality.

So test the prose:

- Every plan named in `llms.txt`, `README.md` and the pricing section **exists in the `plans`
  table**, and every active plan is named. This would have caught the phantom Custom plan.
- Prices quoted in `llms.txt` and `README.md` **match `plans.price_cents`**.
- Every URL in `sitemap.xml` returns 200 on the preview.
- `robots.txt` parses, and `/dashboard` is disallowed for **every** declared user-agent group,
  not just `*`. This would have caught the bug fixed this pass.
- No dead brand strings (`plinth`, `onplinth`, `plinth.sh`) anywhere in `public/` or `src/`.
- Every domain named as "blocked" in public docs is **re-probed**, and the test fails if a
  supposedly blocked domain now returns readable structured data. This would have caught Nike.

These run nightly as well as per-PR, because the world changes even when the code does not.

### 4.5 Remaining audit items (Phase 4)

Safe to do once CI can verify them, which is exactly why they were deferred this pass:

- Regenerate `src/integrations/supabase/types.ts` (deferred because it was unverifiable).
- Add `lastmod` to the sitemap from git history.
- Add `FAQPage` JSON-LD. Highest-leverage remaining GEO win.
- Add `BreadcrumbList` to docs pages.
- Drop `@modelcontextprotocol/sdk` and `mcp-tanstack-start`, which are imported nowhere.
- Rename `package.json` from `tanstack_start_ts`.
- Document `has_role` exposure as intentional in the migration.

---

## 5. Guardrails

These exist because an unsupervised agent optimising for "make CI green" has a predictable set of
failure modes.

1. **Never weaken a test to make it pass.** This is the single most likely failure and it silently
   destroys the value of everything above. If a test fails, the default assumption is that the
   code is wrong. Changing an assertion, lowering a coverage threshold, adding `skip`, or
   loosening a matcher requires stopping and asking. Encode it: coverage thresholds and the
   scorecard workflow are **protected paths**; any diff touching them stops the loop.
2. **Never push to `main`.** Work happens on the branch. Merging stays human.
3. **Never run destructive SQL against production.** Schema work goes through a migration file
   reviewed in the PR. Experiments use a Supabase branch or a rolled-back transaction, as done
   for the `has_role` probe this pass.
4. **Stuck detector.** If the same gate fails three consecutive times without the error changing,
   stop and escalate with the logs. Do not keep pushing variations.
5. **No new runtime dependencies.** DevDependencies limited to the approved list in Phase 0 step 3. Anything else needs a human.
6. **Cost ceiling.** No metered call (Exa, Bright Data, any paid API) without an explicit per-run
   cap. The truth tests in 4.4 use plain fetches only.
7. **Secrets never leave CI.** The agent reads job logs, which are already redacted. It never
   handles a key.
8. **Every loop iteration ends with a pushed commit or an explicit escalation.** Never silence.

---

## 6. What cannot be autonomous

Be honest about the boundary. These need you.

| Item                                                           | Why                                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Rotate the exposed Stripe and Supabase keys**                | Dashboard access plus secret handling. **Do this first, independent of everything above** |
| Enable leaked password protection                              | Supabase Auth dashboard toggle                                                            |
| 301 `onplinth.io` to `legibility.io`                           | Vercel domain config                                                                      |
| Create `support@legibility.io`                                 | Needs a real mailbox before `mcp.json` can stop using a personal Gmail                    |
| `og.png` and `favicon.png`                                     | You have these                                                                            |
| Merging the PR to `main`                                       | Deliberately human                                                                        |
| Accepting the Lighthouse and coverage numbers as "good enough" | A judgement call, not a check                                                             |

---

## 7. Sequencing and realistic effort

| Phase | Content                                                            | Sessions | Gate to proceed                            |
| ----- | ------------------------------------------------------------------ | -------- | ------------------------------------------ |
| 0     | Substrate: PR, vitest, blocking lint, format, scorecard, subscribe | 1        | CI verdict is trustworthy                  |
| 1     | Money-path unit tests, 100 percent on those files                  | 1 to 2   | Tier 1 green                               |
| 2     | Route integration tests, global coverage 80                        | 1 to 2   | Tier 1 green at the higher threshold       |
| 3     | Playwright, axe, Lighthouse, truth tests                           | 2        | Tier 2 green                               |
| 4     | Remaining audit items                                              | 1        | Tier 1 and 2 green, three consecutive runs |
| 5     | Steady state: nightly scorecard, weekly truth tests                | ongoing  | n/a                                        |

Phase 5 matters more than it looks. The truth tests in 4.4 are the ones that keep the repo honest
after the agent stops paying attention, and they are the direct answer to how this repo drifted
into publishing claims that were not true.

---

## 8. Starting it

```
1. Rotate the exposed keys.            <- you, now, independent of the rest
2. Approve this plan.
3. Say "run Phase 0".
```

From there the agent opens the PR, subscribes to its activity, and works the loop. It reports at
each phase gate and escalates on anything in section 6 or any guardrail trip in section 5.
