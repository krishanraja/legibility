# Phase 0: live-state reconciliation

**Run:** 2026-08-06. **Against:** `PLINTH_BRIEF_v2.md`, this repo at `75703fb`, Supabase
`cgkcplcamsijghalintq`, and the live deploys.
**Spend:** $0.00. No Plinth API calls, no Exa, no Bright Data. The cohort probe used direct
`curl` against public retailer URLs. Ceiling was $5.

**Gate result: FAIL.** The finding is the one the brief anticipated as the fail branch, and it is
narrower than feared. Details in section 4.

---

## 1. The headline number

The brief says the measurement apparatus is dividing by zero. That is confirmed, and it is
stronger than "small N". It is a literal, unbroken zero.

| Table               | Rows  |
| ------------------- | ----- |
| `usage_events`      | **0** |
| `product_cache`     | **0** |
| `outcome_reports`   | **0** |
| `resolutions`       | 0     |
| `ops_alerts`        | 0     |
| `api_keys` (active) | 1     |
| `subscriptions`     | 4     |
| `profiles`          | 4     |
| `golden_eval_runs`  | 1     |
| `ops_daily`         | 32    |

`ops_daily` covers 2026-07-05 to 2026-08-05 without a gap. Across all 32 days:
`sum(total_calls) = 0`, `sum(trusted_reads) = 0`, `sum(active_accounts) = 0`.

The rollup has been running correctly and faithfully recording nothing for 32 consecutive days.

### The RPCs today

- `northstar_weekly()` returns **0 rows**.
- `trust_rate_by_method()` returns **0 rows**.
- `kill_dashboard()` returns: `live_trust_rate` null (`no-data`), `active_accounts_28d` 0
  (`watch`), `outcome_reports_30d` 0 (`watch`), `hard_domain_share` null (`info`).

`check_kill_floor()` requires at least 10 calls in the trailing 7 days before it will evaluate.
At zero calls it can never fire. The kill floor is not merely unfired, it is unreachable.

### Revenue

No subscription is paying. All 4 `subscriptions` rows have `status = 'active'` but
**`stripe_customer_id` and `stripe_subscription_id` are both NULL on every row**: 1 starter,
1 growth, 2 free. These are seeded or manually set rows, not Stripe-backed customers.
Revenue is $0 and no Stripe object exists behind any of them.

---

## 2. What the README claims versus live state

Verified by response body, not status code, per the constraint.

| Claim                                       | Live state                                                                                                                                                   | Verdict                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| App live at `plinth-tan.vercel.app`         | `/api/health` returns `{"status":"ok","checks":{"worker":"ok","billing":"configured","x402":"configured"}}`                                                  | **Confirmed**                          |
| `onplinth.io` DNS propagating               | Resolves to `216.150.1.1`, `216.150.1.65`. Serves the same healthy body over TLS                                                                             | **Stale. It is live.**                 |
| Worker is a separate live deploy            | `plinth-worker.vercel.app/health` returns `{"ok":true,"service":"plinth-worker","version":"0.1.0"}`                                                          | **Confirmed**                          |
| Keys sha256-hashed at rest                  | `hashKey()` in `src/integrations/supabase/api-keys.server.ts`, `key_hash` UNIQUE, column-level grants exclude `key_hash` from `anon`/`authenticated`         | **Confirmed**                          |
| Calibration credential                      | `golden_eval_runs`: `iso-63-2026-07-05`, split `test`, **n = 63**, precision 1.0, Wilson low 0.832, adversarial rejection 1.0, GTIN recall 1.0, **ECE 0.19** | **Confirmed, with caveats.** See below |
| `trust_rate_by_method` breaks out by method | It groups by `split_part(domain, ':', 1)`. `domain` is the hostname, or the literal `gtin:` / `name:`. For a URL read it returns the whole hostname          | **Wrong. It is by domain, not method** |
| Metered overage not reported to Stripe      | Correct, no such code exists                                                                                                                                 | **Confirmed honest**                   |
| Webhooks do not exist                       | Correct, tables reserved and unused                                                                                                                          | **Confirmed honest**                   |
| x402 on Base Sepolia, no live settlement    | Confirmed in `src/lib/api/x402.server.ts`. Wired only into `/api/mcp`, not into any REST route                                                               | **Confirmed**                          |

### On the calibration credential

The brief proposes leading Phase 2 with "precision 1.0 at the gate, Wilson lower bound 0.832".
That number is real and recorded. Two things to know before it goes on a public page:

1. **n = 63.** The Wilson lower bound of 0.832 is doing exactly the job it should, which is
   admitting that a small sample cannot support a claim of 1.0. Publish the bound, not the 1.0.
2. **ECE is 0.19.** Expected calibration error of 19 percent is not a strong calibration number.
   Precision at the gate is excellent; the probability estimate across the whole range is not
   yet well calibrated. The defensible public claim is "of the reads we call trusted, we have
   not yet been wrong on a held-out set of 63, lower bound 83.2 percent". It is not
   "our confidence number is a calibrated probability" in the general sense. The stronger of
   those two claims is the one currently in the README and in `docs/KILL-CRITERIA.md`.

This matters more than it looks. The brief's whole Phase 2 thesis is that calibrated judgement
is the moat and the referee's credibility is the entire asset. Overclaiming the calibration on
the page that establishes the referee is the one error that cannot be walked back.

---

## 3. The panel versus cache question

**Answered: a new append-only observation table is required. `product_cache` cannot serve.**

Three independent reasons, in ascending order of severity.

1. **It is shaped as a cache.** `cache_key` is `NOT NULL UNIQUE`
   (`product_cache_cache_key_key`), `plinth_id` carries a unique partial index, and there is no
   version, sequence, or observed-at series column. `fetched_at` is a single timestamp that an
   upsert overwrites. A re-read replaces the row. The history is destroyed by design, which is
   correct behaviour for a cache and fatal for a panel.

2. **A cron actively deletes from it.** `plinth-cache-purge` runs every 30 minutes:
   `DELETE FROM public.product_cache WHERE expires_at < now() OR takedown = true`. Any panel
   built on this table would be silently truncated twice an hour.

3. **This repo never writes to it at all.** An exhaustive search of `src/` finds exactly one
   reference to `product_cache`, the generated type at `src/integrations/supabase/types.ts:236`.
   No insert, no upsert, no select. The only writer would be the worker, and the table has 0
   rows, so nothing has ever landed in it.

### Are nulls and below-gate reads persisted?

**Partly, and the part that is missing is the part the brief needs.**

They are persisted, in `usage_events`, and this is better than the brief assumed. The insert at
the end of each `/api/v1/*` route is **unconditional**: it runs for null products, below-gate
reads, upstream 502s, and non-JSON bodies alike, with `billable = false`. Nothing is discarded
on the floor.

But look at what a failed read actually records. `usage_events` columns:

```
id, user_id, api_key_id, tool, endpoint, cached, status, cost_usd, latency_ms,
request_id, meta, created_at, confidence, product_returned, domain,
envelope_hash, calibration_version, billable
```

Against the five fields the brief's gate requires:

| Required field     | Present?              |
| ------------------ | --------------------- |
| domain             | **Yes**, `domain`     |
| confidence         | **Yes**, `confidence` |
| trusted or not     | **Yes**, `billable`   |
| **method**         | **No such column**    |
| **failure reason** | **No such column**    |

And the reason `method` is missing is not that the worker withholds it. `stampFromResponse()`
in `src/lib/api/meter.ts:46-56` parses the worker envelope and lifts `request_id`, `confidence`,
`product`, `calibration_version`, `cost_usd`, and `cached`. **It never reads `method`.** The
README documents `method` as part of the response, so the worker is returning it and the app is
dropping it on the floor at that line, into a column that does not exist to receive it.

There is no failure-reason field anywhere. A blocked read, a 200 with no structured data, a
timeout, and a low-confidence extraction are today indistinguishable in the database: all four
are a row with `product_returned` false or null and `billable = false`. The brief calls the
typed failure reason "the most valuable column in the system". It does not exist, and the raw
material to populate it is being parsed and discarded one line before it would be stored.

---

## 4. The gate

**Criterion:** run 10 retailer URLs, and for all 10 a durable row is written recording domain,
method, confidence, trusted or not, and failure reason.

**Result: FAIL**, and it fails structurally rather than empirically. No 10-URL run can pass it.
Two of the five required fields have no column to land in, so the row the gate asks for cannot
be written regardless of what the worker returns. Running the URLs to observe this would spend
money to confirm what the schema already proves.

Per the brief, this is the fail branch: **Plinth cannot remember its own failures.** The precise
shape of the deficiency, which is narrower and cheaper to fix than "cannot remember":

- It remembers **that** a read failed (the row is written, unconditionally, with `billable=false`).
- It cannot remember **how** it failed (no failure-reason column).
- It cannot remember **what was tried** (no method column, though the worker sends one).

That is two columns and about six lines in `meter.ts`, not a subsystem.

### What I ran instead: the zero-cost readability probe

Since the persistence gate was answerable from schema, I spent the gate budget on the question
underneath Phase 2 instead: what does the null column actually look like? Direct `curl` with a
browser User-Agent, checking the response body for `application/ld+json` and
`"@type": "Product"`. Cost $0.00.

| Domain        | HTTP | Bytes     | JSON-LD Product          | Verdict            |
| ------------- | ---- | --------- | ------------------------ | ------------------ |
| gymshark.com  | 200  | 1,068,004 | yes (7)                  | READABLE           |
| drsquatch.com | 200  | 689,218   | yes (1)                  | READABLE           |
| allbirds.com  | 200  | 2,737,826 | JSON-LD but no `Product` | PARTIAL            |
| ridge.com     | 403  | 4,545     | no                       | BLOCKED            |
| **nike.com**  | 200  | 771,028   | **yes (1)**              | **READABLE**       |
| apple.com     | 200  | 367,470   | no                       | NO_STRUCTURED_DATA |
| lego.com      | 403  | 5,855     | no                       | BLOCKED            |
| amazon.com    | 200  | 3,779     | no                       | BLOCKED, JS shell  |
| walmart.com   | 200  | 15,194    | no                       | BLOCKED, JS shell  |

**Caveat, stated before the conclusions:** this ran from this container's egress IP, not from
the worker's Vercel IP, and without the worker's extraction logic. It measures what a plain
browser-UA fetch sees. It is not a measurement of what Plinth sees. Treat every row as a lead to
verify through the worker, not as a result.

With that caveat, three things are worth Krish's attention.

1. **The failure modes are heterogeneous, and "blocked" is the minority.** Only 2 of 9 returned
   a 403. The larger category is **200 OK with nothing readable in the body**: Amazon and
   Walmart serve a JS shell, Apple serves 367 KB of HTML with no JSON-LD at all. This is a
   direct vindication of the "trust the body, not the status code" constraint, and it is the
   strongest argument for the typed failure reason. `blocked`, `no_structured_data`, and
   `js_shell` are three genuinely different findings about a merchant, with three different
   sales conversations attached, and today all three are one undifferentiated null.

2. **Nike returned clean JSON-LD `Product`.** The README states as fact that "bot-hostile
   retailers (Apple, Nike, Lego and similar) block the datacenter IP". Lego does. Nike, from
   here, did not. If that reproduces from the worker, the README is overstating the scope
   reduction, and one of the three named examples in the public-facing honest-scope section is
   wrong. Worth checking before that claim appears in an index.

3. **Apple is not blocked, it is empty.** A 200 with 367 KB and no structured data is a
   different finding from a 403, and a much better outbound hook. "You are not blocking agents,
   you are invisible to them" is a conversation. "You are blocking us" is an argument.

---

## 5. Environment and hygiene

### Secrets

**No live secret is present in any tracked file.** A scan across tracked content for
`sk_live_*`, `sk_test_*`, JWT-shaped strings, service-role patterns, and `lgk_*` returned
nothing. CI also runs `gitleaks/gitleaks-action@v2` on every push and PR with
`fetch-depth: 0`, so history is covered.

**However:** `docs/OUTSTANDING.md` records that previously exposed Stripe `sk_live` keys and the
Supabase service-role key are **still unrotated**. Not in the tree, but believed exposed and
still valid. Rotation procedure is in `docs/security-rotation.md`. This is a founder action and
is not blocked on any of the work below. It should not wait for Phase 1.

One key is hardcoded on purpose and is fine: the PostHog project key at
`src/routes/__root.tsx:151` is a publishable client-side key, not a secret.

### Environment variables

Every var read by code, and how it was verified:

| Variable                                                                | Read at                  | Verified                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `PLINTH_EXTRACTOR_URL` / `_TOKEN`                                       | 5 routes + health        | **Set.** `/api/health` returns `worker: ok`, which requires a successful upstream fetch                             |
| `STRIPE_SECRET_KEY`                                                     | billing, webhook, health | **Set.** health returns `billing: configured`                                                                       |
| `X402_RECIPIENT`                                                        | x402, health             | **Set and non-zero.** health returns `x402: configured`, which is keyed on the recipient not being the zero address |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | client/auth              | **Set.** The app serves authenticated pages                                                                         |
| `X402_FACILITATOR`, `_NETWORK`, `_ASSET`, `_PRICE_ATOMIC`               | x402.server.ts           | Have working defaults. Not separately verified                                                                      |
| `STRIPE_WEBHOOK_SECRET`                                                 | stripe/webhook.ts        | **Not verified.** No way to confirm without triggering a webhook                                                    |
| `APP_BASE_URL`                                                          | billing.functions.ts     | **Not verified**                                                                                                    |

Named in `.env.example` but read by no code: `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PROJECT_ID`,
`RESEND_API_KEY`. The last one matters: `docs/KILL-CRITERIA.md` says alert delivery goes via
"Resend via `pg_net`". There is no `pg_net` usage anywhere and no code reads `RESEND_API_KEY`.
The doc is honest that delivery is unwired; the env var is a leftover.

### The em dash rule

CI enforces it, at `.github/workflows/ci.yml:32-37`, as a recursive `grep -rn` for the em dash
character over `src/`, failing the build on any hit. (The character itself is not reproduced in
this report, so that this file stays clean if the rule is extended to `docs/`.)

Coverage gaps:

- **`src/` only.** `docs/`, `docs-internal/`, `README.md`, `supabase/` are all unchecked.
- **2 live violations today** in the unchecked area: `docs-internal/design.md` and
  `docs-internal/contributing.md`.
- **The worker repo is not covered at all.** It is a separate repo with its own CI, outside this
  reconciliation.
- The rule as written also recurses into `src/assets/` (binary PNGs) and the generated
  `src/routeTree.gen.ts`.

The brief asks for this to extend to the worker repo and to all generated report copy. Both are
Phase 1 and Phase 2 work respectively, not done here.

---

## 6. Where the brief and the repo disagree

Per working rule: when the brief contradicts the repo, the repo wins. Recorded here.

1. **"Are nulls persisted anywhere, or discarded? If discarded, that is the most important gap."**
   They are persisted. The gap is real but it is one level finer than the brief expected: the
   rows exist, the _typed reason_ does not. This makes Phase 1 meaningfully cheaper. The
   append-only observation table still has to be built, but the app is already writing an
   unconditional row per call, so the wiring pattern and the insert site both exist.

2. **"`trust_rate_by_method`, domain and method stamped per call."** Method is not stamped per
   call. There is no method column, and the RPC named `by_method` groups by domain. The brief's
   component table credits Plinth with a readability index that is closer than it looks on the
   domain axis and entirely absent on the method axis.

3. **"onplinth.io DNS propagating."** It has propagated. It is live and serving.

4. **The `mindmaker-os` skill is stale, as the brief says.** Confirmed against this repo: the
   skill describes Plinth as having "no product-truth endpoint, customer sweep, or Stripe webhook
   yet" and being waitlist-stage. All three are wrong. Four tools ship over REST and MCP, and
   `src/routes/api/stripe/webhook.ts` exists with HMAC verification and a 300 second replay
   window. That skill is outside this repo, so this is a flag, not a fix.

---

## 7. What this means for Phase 1

The brief's diagnosis holds and the gate outcome sharpens it. The binding constraint is
distribution, and the instrument that would prove it is two columns short of working.

Three things follow, and none of them are large.

1. **The panel needs its own append-only table.** `product_cache` is disqualified on all three
   counts in section 3. This is not a debate.

2. **The typed failure reason is the whole job.** The probe in section 4 shows why: blocked,
   JS shell, and no structured data are three different findings on nine domains, and today
   they collapse into one null. That taxonomy is the product, and it is the outbound hook.

3. **`method` is a six-line fix.** The worker already returns it. `meter.ts:46` already parses
   the envelope. Adding a column and a line to lift it is the cheapest real improvement
   available in this repo.

The one item that should not wait for a decision: **rotate the Stripe and Supabase keys**
recorded as still-exposed in `docs/OUTSTANDING.md`. Independent of everything above.

---

## Stop. Waiting for Krish.

Per the brief, Phase 0 ends here and no feature code was written. Open decisions are the four in
brief section 11 (name collision, front door, cohort, disclosure posture), plus one this
reconciliation adds:

**How hard should the public calibration claim be?** The ECE of 0.19 and n of 63 support
"we have not been wrong on the reads we called trusted, lower bound 83.2 percent". They do not
support the general "confidence is a calibrated probability" currently in the README and
`docs/KILL-CRITERIA.md`. If the index is going to establish Plinth as the referee, that sentence
is the one to get right first, and it may need softening in the README before Phase 2 rather
than after.
