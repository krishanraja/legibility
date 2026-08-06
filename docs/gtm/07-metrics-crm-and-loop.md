# 07 Metrics, CRM, and the Loop

This is the "measure" stage of the pipeline in `00-operating-brief.md`. It
tells the fleet exactly what to track, what each number has to be, how to keep
the CRM current without a human, how to write the weekly rollup, and how to
route what agents learn back into the product. Everything here ladders to the
single North Star and the kill criteria in the operating brief. If a number in
this file ever disagrees with `00-operating-brief.md` or
`repo/docs/KILL-CRITERIA.md`, those win.

Two hard rules before anything else. No em dashes, ever (commas, periods,
colons, or "to" for ranges). Never invent a number: every metric in a report
comes from a named RPC or a query against the live database, and if the query
returns zero rows the report says zero, not a guess.

Last reviewed: 2026-07-06.

---

## 1. The pipeline and stage definitions

One pipeline, six live stages plus three terminal states. An account moves
forward only when its **exit criterion** is met, and the exit criterion of one
stage is the **entry criterion** of the next. Stages `sourced` through
`design-partner` are sales-driven and live in the CRM (section 3). Stages
`activated` and `outcome-reporting` are product-instrumented and are read from
the Legibility database, joined to the CRM row by `legibility_user_id`. An agent never
hand-sets `activated` or `outcome-reporting`; those flip from the data.

| Stage               | Definition (account is here when...)                                                     | Entry criterion (what moves it in)                                                             | Exit criterion (what moves it on)                                                                | Owner agent          | Source of truth                   |
| ------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- | --------------------------------- |
| `sourced`           | A candidate account exists with a captured signal, not yet scored against the gates      | An agent found an ICP-shaped target (see `01-icp-and-targeting.md`) and wrote a CRM row        | Fit score computed and all 3 gates evaluated (section 3 rubric)                                  | sourcing agent       | CRM                               |
| `qualified`         | Passes all 3 qualification gates, hits no disqualifier, score >= 50                      | Gates all true, disqualifiers all false, `score >= 50`                                         | A demo is booked or an async live-read proof is sent and opened                                  | qualifier agent      | CRM                               |
| `demoed`            | Has seen a real live read on one of their own target URLs or a proof URL                 | Demo delivered per `04-demo-and-qualification.md` (never a mock)                               | Prospect verbally accepts the design-partner offer, or asks for the agreement                    | outreach agent       | CRM                               |
| `design-partner`    | Accepted the offer, has an account and an API key, has agreed to the two non-negotiables | Offer accepted per `06-design-partner-motion.md`; `legibility_user_id` recorded on the CRM row | First trusted read lands for that `legibility_user_id` (`billable = true`)                       | partner agent        | CRM, joined to Legibility DB      |
| `activated`         | Their account has produced at least one trusted read (confidence >= 0.7)                 | First `usage_events` row with `billable = true` for `legibility_user_id`                       | First `outcome_reports` row for that account                                                     | product-instrumented | Legibility DB (`usage_events`)    |
| `outcome-reporting` | `report_outcome` is flowing on a regular cadence                                         | At least one `outcome_reports` row, then a second in a later week                              | Stays here; this is the goal state. Regression to no reports for 60 days triggers the kill check | product-instrumented | Legibility DB (`outcome_reports`) |

**Terminal and holding states** (set explicitly, with a reason):

| State          | Set when                                                                                              | Re-entry rule                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `disqualified` | Any one hard disqualifier is true (section 3). Record `disqualify_reason`                             | Only if the disqualifier provably changes (e.g. they re-target off the anti-bot head). Log the change before re-opening |
| `parked`       | Qualified but `score < 50`, or no reply after the full outreach cadence in `03-outreach-sequences.md` | Auto-review in 90 days, or on a fresh intent signal that raises the score to >= 50                                      |
| `churned`      | Was `activated` or `outcome-reporting`, then zero keyed calls for 28 days                             | Founder-touch only. Do not re-run cold outreach on a churned partner                                                    |

**Stop conditions inside the pipeline.** Do not advance an account past
`qualified` if any disqualifier flips true later (targets go majority
anti-bot head, use case turns into price tracking, or they need live checkout /
inventory / a legal price guarantee). Move it to `disqualified` with the
reason. Do not open a demo for an account whose priority domains are majority
Amazon, Walmart, Target, or Apple; that is a disqualifier, not a hard demo.

---

## 2. The metrics that matter

Five metrics, in priority order. The order is the same as the winning signals
in the operating brief: outcome closure first, then identity storage, then
activation, then the North Star volume, with trust rate underneath all of it as
the floor. Every metric below has the exact call that produces it. Run these,
do not estimate them.

### 2.1 Outcome reports per week (the moat igniting, highest priority)

The single most important number the fleet exists to produce. Any value above
zero from a design partner is the moat starting its clock.

```sql
-- outcome reports by week, and how many distinct accounts are reporting
select date_trunc('week', created_at) as week,
       count(*)                       as reports,
       count(distinct user_id)        as reporting_accounts
from outcome_reports
group by 1
order by 1 desc;
```

Targets: from zero to the first report is the ignition event, flag it loud in
the rollup. Sustained cadence target is at least 1 reporting account with
reports in the current and prior week. Red: zero reports for two consecutive
months after the first design partner is live (kill signal, section 6).

### 2.2 first_trusted_read activation

Time from account creation to first trusted read. Target under 3 minutes. This
is instrumented via `usage_events`; there is no separate activation RPC, derive
it as below (first `billable` row per user versus account creation).

```sql
-- per-account activation latency in minutes (null second value = not activated yet)
select p.id as user_id,
       p.created_at as signed_up_at,
       min(u.created_at) filter (where u.billable) as first_trusted_read_at,
       extract(epoch from (min(u.created_at) filter (where u.billable) - p.created_at))/60
         as ttfr_minutes
from profiles p
left join usage_events u on u.user_id = p.id
group by p.id, p.created_at
order by signed_up_at desc;
```

Targets: median `ttfr_minutes` under 3 for accounts created in the trailing 14
days. Report the count of new accounts that never activated (a null
`first_trusted_read_at`) as the activation leak.

### 2.3 North Star: weekly trusted reads per active account

The canonical volume metric. A trusted read is a call that returned a product
at confidence >= 0.7 (`billable = true`). An active account is one with at least
one keyed call in the trailing 7 days.

```sql
-- canonical North Star series, one row per account per week
select * from northstar_weekly();
```

Report the **median trusted reads per active account per week**, not the mean
(a single heavy account skews the mean). Beta target: median 7 or more. Warn
band: 3 to 7. Red: median under 3 per week with 10 or more active accounts,
sustained 8 weeks (kill signal). Also report the repeat rate (share of active
accounts that were also active the prior week); red is under 30% under the same
conditions.

### 2.4 Pipeline velocity

Movement, not just standing counts. Read from the CRM.

- **Stage counts:** accounts in each stage right now.
- **Weekly conversion:** for each adjacent pair of stages, `moved_forward /
entered_prior_stage` over the trailing 4 weeks.
- **Dwell time:** median days an account has sat in its current stage. Flag any
  account past the dwell ceiling: `sourced` 3 days, `qualified` 7 days,
  `demoed` 10 days, `design-partner` 14 days to activation. Past ceiling means
  the `next_action` is stale, re-decide it or park the account.

### 2.5 Trust rate (the floor under everything)

Share of calls at or above the 0.7 gate, per source method. This is gate-pass,
not correctness. Report it next to precision-at-gate from the golden set and
never conflate the two.

```sql
select * from trust_rate_by_method();          -- per-method gate-pass rate, live traffic
select precision_at_gate, wilson_low, created_at
from golden_eval_runs order by created_at desc limit 1;   -- measured correctness at the gate
```

Floor: overall trust rate must stay at or above 0.60. Below 0.60 the thesis
fails regardless of GTM, and it is a strategy meeting (section 6).

### 2.6 The kill dashboard in one call

All SQL-checkable kill signals in a single row: live trust rate versus the 0.60
floor, 28-day active accounts, 30-day outcome reports, and hard-domain share.

```sql
select * from kill_dashboard();
```

Run this every weekly rollup and every monthly kill check. The signals it does
not cover (a branded competitor shipping, cheap-LLM parity, merchant-push
protocols) are checked by hand per section 6.

---

## 3. The CRM the fleet maintains

Lightweight, one row per prospect account. It lives as an n8n data table in the
control-center fleet (or a Supabase table in the control-center project, same
columns). An agent reads it, decides the next action, and writes it back. It is
separate from the Legibility product database; the join key to product metrics is
`legibility_user_id`, which stays null until the account signs up.

### 3.1 Schema

| Column               | Type                  | Written by                                      | Notes                                                                       |
| -------------------- | --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `account_id`         | text (pk)             | sourcing agent                                  | Stable slug, e.g. company domain                                            |
| `name`               | text                  | sourcing agent                                  | Company or team name                                                        |
| `domain`             | text                  | sourcing agent                                  | Their site                                                                  |
| `target_domains`     | text                  | qualifier agent                                 | The domains their agent needs to read (drives gate 3 and the feedback loop) |
| `signal`             | text                  | any agent                                       | Freshest observed reason they fit: the wedge and the evidence. One line     |
| `score`              | int (0 to 100)        | qualifier agent                                 | Fit + intent, computed by 3.2                                               |
| `stage`              | enum                  | agents (sales stages) / system (product stages) | Section 1 values                                                            |
| `owner_agent`        | text                  | router                                          | Which fleet agent owns the next action                                      |
| `last_touch`         | timestamptz + channel | outreach agent                                  | When and how last contacted                                                 |
| `next_action`        | text                  | owner agent                                     | The single next move, decided by 3.3                                        |
| `next_action_due`    | date                  | owner agent                                     | When it must happen; drives the daily sweep                                 |
| `legibility_user_id` | uuid (nullable)       | partner agent                                   | Join key to `usage_events` / `outcome_reports`; null until signup           |
| `disqualify_reason`  | text (nullable)       | any agent                                       | Required when `stage = disqualified`                                        |
| `notes`              | text                  | any agent                                       | Append-only log of what happened                                            |

### 3.2 Scoring rubric (compute `score`, deterministic)

Crosswalk to `01-icp-and-targeting.md`: sourcing produces a `fit_score` (0 to 5,
tiers A/B/C/DROP) from ICP fit alone. This CRM `score` (0 to 100) adds intent
and demo signal on top. Carry the fit tier in as the base: fit_score 4 to 5 (tier
A) starts at 60, fit_score 3 (tier B) starts at 40, fit_score 2 (tier C) starts at
20, fit_score 0 to 1 (DROP) does not enter the CRM. Then add intent per below.
The two instruments use the same A/B/C letters on purpose: a tier-A fit that
clears the gates lands in CRM band A.

Evaluate the disqualifiers first. If any one is true, set `score = 0`, `stage =
disqualified`, and write `disqualify_reason`. Stop.

Disqualifiers (any one true kills it):

1. Priority target domains are majority Amazon, Walmart, Target, Apple, or
   other top-tier anti-bot heads.
2. Price-tracker or time-series price-monitoring use case.
3. Needs live checkout / order placement, inventory or stock feeds, or a legal
   price guarantee.

Otherwise score is additive, capped at 100:

| Component                         | Points | Condition                                                                                                                  |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Gate 1: programmatic consumer     | +20    | Building an agent/automation that consumes product data programmatically, wants a typed schema, not a human dashboard      |
| Gate 2: existing extraction spend | +20    | Already pays for Diffbot, Firecrawl, ScrapingBee, Playwright, or Browserless, or hand-rolls JSON-LD                        |
| Gate 3: reachable domains         | +25    | Priority domains majority reachable today (JSON-LD, Shopify, barcodes, cooperating catalogues, supplier long-tail)         |
| Intent: public buy-flow build     | +15    | Public evidence they are building a buy-this-for-me, procurement, or comparison agent                                      |
| Moat-critical subset              | +20    | Procurement or buy-flow on supplier and long-tail domains (highest WTP, audit-trail requirement, legally readable traffic) |

Bands and routing:

- **A, score 80 to 100:** work now, design-partner candidate. Owner is the
  qualifier then partner agent.
- **B, score 50 to 79:** qualified, nurture. Standard outreach cadence.
- **C, score under 50:** `parked`. Do not spend outreach cycles; auto-review in
  90 days.

An account cannot reach `qualified` with all three gates false, even if intent
points push it over 50. All three gates must be true to advance past
`qualified`; the intent points only rank order among qualified accounts.

### 3.3 Next-action decision rules

| If stage is         | And                                           | Then next_action                                                      | Stop condition                                                     |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `sourced`           | score not yet computed                        | Run gates + disqualifiers, set score                                  | Disqualifier true: move to `disqualified`                          |
| `qualified`         | band A or B                                   | Pick wedge (`02-`) and send outreach step 1 (`03-`)                   | Cadence exhausted, no reply: `parked`                              |
| `qualified`         | band C                                        | Set `parked`, no touch                                                | Fresh signal raising score to >= 50                                |
| `demoed`            | offer not yet accepted                        | Send the design-partner offer (`06-`)                                 | 2 declines or 14 days silent: `parked`                             |
| `design-partner`    | `legibility_user_id` set, no trusted read yet | Onboard: help wire `legibility_id` storage + `report_outcome` (`06-`) | 14 days to activation exceeded: founder-touch, then evaluate churn |
| `activated`         | no outcome reports yet                        | Founder cadence to wire `report_outcome` on real buys                 | 60 days activated with zero reports: kill check                    |
| `outcome-reporting` | reports flowing                               | Keep the feedback cadence, log misses (section 5)                     | 60 days no reports: back to kill check                             |
| any                 | past dwell ceiling (2.4)                      | Re-decide the action or park                                          | See dwell ceilings                                                 |

### 3.4 Copy-paste CRM row template

Create or update via the n8n data-table tool. Fill every `{{merge_field}}`;
leave `legibility_user_id` empty until signup.

```json
{
  "account_id": "{{company_domain}}",
  "name": "{{company_name}}",
  "domain": "{{company_domain}}",
  "target_domains": "{{comma_separated_domains_their_agent_reads}}",
  "signal": "{{wedge}} :: {{evidence_one_line}}",
  "score": {{computed_score_0_to_100}},
  "stage": "{{sourced|qualified|demoed|design-partner|disqualified|parked}}",
  "owner_agent": "{{agent_name}}",
  "last_touch": "{{iso_timestamp}} / {{channel}}",
  "next_action": "{{single_next_move}}",
  "next_action_due": "{{yyyy-mm-dd}}",
  "legibility_user_id": "{{uuid_or_empty}}",
  "disqualify_reason": "{{reason_or_empty}}",
  "notes": "{{iso_timestamp}} {{what_happened}}"
}
```

---

## 4. The weekly rollup

Posted once a week to the control center. Fixed format so it is diffable
week over week. Every filled value comes from section 2 or the CRM. If a query
returns nothing, write `0` or `none`, never a guess. Order is deliberate:
moat signals first, volume second, kill status third, asks last.

```md
LEGIBILITY GTM ROLLUP :: week of {{monday_date}}

MOAT SIGNALS (priority order)

- Outcome reports this week: {{reports_this_week}} from {{reporting_accounts}} account(s)
  (prior week: {{reports_prior_week}}). Ignition: {{yes_first_ever | ongoing | none}}
- Accounts storing legibility_id as a foreign key: {{count}} ({{delta_vs_prior}})
- New activations this week: {{new_activated}}; median time-to-first-trusted-read: {{ttfr_median}} min
  (target < 3). Activation leak (signed up, never activated): {{never_activated_count}}

NORTH STAR

- Active accounts (>=1 keyed call, trailing 7d): {{active_accounts}}
- Median trusted reads / active account / week: {{median_tr}} (target 7+; warn 3 to 7; red < 3)
- Repeat rate (active this week and last): {{repeat_pct}}% (red < 30%)
- Overall trust rate: {{trust_rate}} (floor 0.60); precision-at-gate (last golden run): {{p_at_gate}}

PIPELINE

- Standing: sourced {{n}} / qualified {{n}} / demoed {{n}} / design-partner {{n}}
  / activated {{n}} / outcome-reporting {{n}}
- Moved forward this week: {{moves_summary}}
- Conversion (4wk): qualified->demoed {{pct}}%, demoed->partner {{pct}}%, partner->activated {{pct}}%
- Past dwell ceiling (need re-decision): {{count}} -> {{account_ids}}

KILL DASHBOARD (from kill_dashboard())

- Trust rate vs 0.60 floor: {{GREEN|RED}} ({{value}})
- 28-day active accounts: {{value}}
- 30-day outcome reports: {{value}}
- Hard-domain share of URL calls: {{pct}}% ({{GREEN if <50 | RED if >=50}})
- Competitor watch (manual): {{none | vendor + what shipped}}

ASKS / BLOCKERS FOR KRISH

- {{founder_actions_this_week_or_none}}
```

Any `RED` row in the kill dashboard, or an activation median over 3 minutes for
two weeks running, promotes to the "ASKS / BLOCKERS" section and triggers the
section 6 review. The rollup is not the place to soften a red number.

---

## 5. The feedback loop (route what agents learn back to product)

Outreach and demos surface product gaps faster than any internal test. The
fleet's job is to capture those as structured signals and route them, not to
argue them in the rollup. Five categories, each with a trigger threshold (so one
anecdote does not become a roadmap) and a destination.

| Observed                                                                                                                | Category           | Trigger to escalate                                                      | Destination                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| A specific hard domain shows up in target lists and fails to return a trusted object                                    | `hard-domain-gap`  | Same domain in the `target_domains` of 3 or more qualified accounts      | Product: unlocker/coverage backlog. Never promise it as shipped            |
| Prospects keep needing a field Legibility does not return well (e.g. dimensions, MPN, warranty)                         | `missing-field`    | Same field asked by 3 or more qualified accounts                         | Product: schema backlog                                                    |
| A design partner says a confidence looked wrong (over or under stated) on a real read                                   | `calibration-miss` | Any instance from an activated account, with the URL and returned object | Product: calibration / golden-set. Attach `request_id` and `envelope_hash` |
| An objection recurs that current messaging does not answer                                                              | `positioning-gap`  | Same objection in 3 or more demos                                        | Update `02-positioning-and-messaging.md`, not product                      |
| A prospect asks for something on the roadmap (webhooks, SDK, mainnet x402, compare/brief over MCP, auto-billed overage) | `roadmap-ask`      | Log every instance; escalate at 5                                        | Product: demand-rank the roadmap. State honestly it is not shipped         |

Two rules. First, a `hard-domain-gap` or `missing-field` never becomes a sales
promise. It is logged as demand and demand-ranks the roadmap; the agent tells
the prospect the honest scope now. Second, a `calibration-miss` from an
outcome-reporting partner is the highest-value feedback the fleet can produce
(it is a real label on the demand distribution), so it skips the threshold and
routes immediately with the `request_id`.

Copy-paste product-feedback ticket:

```md
LEGIBILITY PRODUCT FEEDBACK :: {{category}}

- Raised by (agent): {{owner_agent}} Date: {{iso_date}}
- Accounts affected: {{account_ids}} ({{count}}, threshold {{threshold}})
- Evidence: {{target_domain_or_field_or_objection}}
- For calibration-miss only: request_id {{id}}, envelope_hash {{hash}}, URL {{url}},
  returned {{object_summary}}, partner-observed truth {{what_they_saw}}
- Honest scope told to prospect: {{what_the_agent_said_is_true_today}}
- Suggested rank: {{P1|P2|P3}}
```

---

## 6. Cadence and stop conditions

**Cadence.**

- **Daily:** sweep the CRM for rows where `next_action_due <= today`; execute or
  re-decide each. Refresh `stage` for any account with a `legibility_user_id` by
  re-reading `usage_events` (activated?) and `outcome_reports` (reporting?).
- **Weekly:** run section 2 queries, post the section 4 rollup, run the section
  5 escalation thresholds and open any tickets that crossed them.
- **Monthly:** run `select * from kill_dashboard();` plus the manual checks
  below and record the result. One red row is a strategy meeting, not a
  footnote.

**Stop conditions (any one halts business-as-usual and escalates to Krish).**
These are the kill signals from `00-operating-brief.md`, `KILL-CRITERIA.md`,
and the MOAT dashboard, restated as fleet-actionable triggers:

1. **Trust rate below 0.60** (`trust_rate_by_method` / `kill_dashboard`) over
   the trailing 4 weeks at 10+ calls. Stop calibrating on new domains until the
   engine clears the floor. The thesis fails here regardless of GTM.
2. **North Star stall:** median under 3 trusted reads per week, or repeat rate
   under 30%, after 8 weeks with 10 or more active accounts. Re-examine ICP fit
   and activation before adding more top-of-funnel.
3. **Moat not igniting:** zero outcome reports for two consecutive months after
   the first design partner is live. The moat is running on manufacturable fuel
   only. Founder-drive the `report_outcome` wiring before sourcing new logos.
4. **Wrong traffic:** hard-domain share of URL calls above 50% sustained. The
   fleet is calibrating domains Legibility cannot legally serve. Re-target sourcing
   toward supplier long-tail and structured retail; tighten gate 3.
5. **Nobody stores the id:** zero accounts with `legibility_id` as a foreign key 90
   days after the id contract is live. Switching cost is not forming; fix
   onboarding in `06-design-partner-motion.md`.
6. **Competitor ships (manual watch):** a branded competitor (Firecrawl,
   Diffbot, Zyte) ships a typed product MCP. Inside 60 days is the corpus kill
   criterion; inside 12 months the window is closing and differentiation must
   already be measurable in outcome reports. Escalate immediately with the
   listing or changelog link.

The whole point of this file is that from here the moat question is a sales
question with a timer on it. The metrics say whether the timer is being beaten.
Report the red numbers first.

---

Last reviewed: 2026-07-06.
