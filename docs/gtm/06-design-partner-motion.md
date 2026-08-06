# 06 Design-Partner Motion (the moat-critical playbook)

This is why the whole GTM exists. Everything in files 01 to 05 is top of
funnel. This file is the funnel's floor: it turns a qualified prospect into a
retained partner who stores the opaque `legibility_id` in their own database and
calls `POST /api/v1/report_outcome` when a Legibility answer leads to a real buy.
That closed-outcome traffic is the only asset that compounds and the only one
no competitor can clone, buy, or backdate. Read `00-operating-brief.md` first;
its CANONICAL FACTS win any conflict. The full defensibility argument is in
`C:/Users/krish/.scratch/audit/legibility/2026-07-04/MOAT.md`.

Last reviewed: 2026-07-06.

---

## 0. The one paragraph an agent must internalize

As shipped, Legibility is a clean API a funded team rebuilds in a quarter. Three
assets make it un-cloneable, and all three are worth exactly zero at zero
users: an outcome-closed calibration flywheel, opaque product identities
carrying history inside customers' own databases, and a demand-weighted private
eval corpus. They start their clocks at the first retained, outcome-reporting
account and not one day earlier. The single decisive label class is outcome
closure: did the agent's buy actually succeed at the stated price and
availability. That label exists only downstream of a real agent acting on a
real Legibility answer, so no competitor can crawl it, purchase it, or
self-adjudicate it at any budget. Landing 2 to 3 partners who report it, inside
the 6 to 12 month window before a branded competitor ships a typed product MCP,
is the whole game. This file is how the fleet does that.

---

## 1. What a design partner is (and is not)

A design partner is not just a paying customer. A paying Starter or Growth
customer is revenue. A design partner is a moat seed: an account whose traffic
lands on domains Legibility can legally read, that acts on Legibility answers in
production, and that agrees to close the loop by reporting outcomes. Most good
paid prospects are NOT design partners, and that is fine. Do not spend
concierge time (founder Slack, priority domain work, discounted headroom) on an
account that cannot or will not report outcomes on legally readable domains.

### 1.1 The design-partner scorecard (score before offering)

Score every candidate. The three REQUIRED rows are pass/fail gates. The
scored rows break ties and set effort.

| Dimension                                     | Type     | Test                                                                                                                                                                                   | Points    |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Use case is procurement / buy-flow            | REQUIRED | They buy, procure, or compare real physical products and an agent acts on the answer (a buy, a PO, a shortlist a human executes). Not a dashboard, not analytics.                      | pass/fail |
| Domain mix is legally readable                | REQUIRED | Majority of their real target domains are Shopify, JSON-LD retailers, cooperating catalogues, supplier long-tail, or barcodes. NOT majority Amazon/Walmart/Target/Apple anti-bot head. | pass/fail |
| Real production volume with downstream action | REQUIRED | They are (or within 2 weeks will be) calling in production, and real buys or matches happen downstream, so outcomes exist to report. A toy integration has nothing to close.           | pass/fail |
| Can integrate within ~2 weeks                 | scored   | A named engineer with bandwidth to store `legibility_id` and wire `report_outcome`.                                                                                                    | 0 to 3    |
| WTP and audit-trail need                      | scored   | Already pays for extraction/scraping/headless; procurement audit trail is a real requirement (corpus band $200 to 2K/mo).                                                              | 0 to 3    |
| Founder-reachable contact                     | scored   | A named human who will join a private Slack and do a weekly 15-minute check-in.                                                                                                        | 0 to 3    |
| Volume weight                                 | scored   | Expected trusted reads/week (higher demand-weighted volume = more label fuel).                                                                                                         | 0 to 3    |

**Decision rule.**

- All 3 REQUIRED = pass AND scored total >= 7 of 12: make the design-partner
  offer (section 3). Open a CRM record tagged `design_partner_candidate`.
- All 3 REQUIRED = pass AND scored total 4 to 6: make the offer only if the
  current live-partner count is below 2. Otherwise keep warm, revisit at 60
  days.
- Any REQUIRED = fail: NOT a design partner. Route to the normal paid motion
  (`05-pricing-objections-and-close.md`) or disqualify. Do not offer concierge
  terms. Stop.

### 1.2 Hard disqualifiers for the partner motion (any one = stop)

These are stricter than the general disqualifiers in `00` because a partner
carries concierge cost.

1. Target domains are majority anti-bot head (Amazon, Walmart, Target, Apple).
   The flywheel would calibrate domains Legibility cannot legally serve. Kill.
2. Price-tracker or time-series price-monitoring use case. Wrong segment, low
   WTP, legal risk, and it never produces a `purchased` outcome. Kill.
3. No downstream action on the answer (pure enrichment into a dashboard a human
   reads). Nothing to close. Route to paid, not partner.
4. Will not agree to the two non-negotiables in section 3. Without both, there
   is no moat seed. Route to paid, not partner.

---

## 2. The target: 2 to 3 partners, not a logo wall

The moat needs retained closing traffic, not references. Corpus Section L.7 is
explicit: a two-person team cannot run an enterprise motion in year one. The
plausible and sufficient version is 2 to 3 founder-sold design partners, no
RFPs, no procurement cycles. Success is defined in section 7. More than 3 live
partners at once is a distraction until the loop in section 5 is running
cleanly on the first ones.

---

## 3. The offer and the ask

### 3.1 What we give

- Free or heavily discounted access with generous trusted-read headroom
  (`{{headroom_reads}}`/mo, well above their expected volume so cost is never a
  reason to hold back a call).
- Direct founder support in a private Slack channel (`{{slack_channel}}`).
- Priority engineering attention on their specific target domains. If a domain
  they need is returning null or low confidence, it goes to the front of the
  queue.
- Roadmap influence and hands-on help wiring outcome closure.

### 3.2 What we ask

Two non-negotiables (no design partnership without both):

1. **Store the opaque `legibility_id` as a foreign key** in their own database,
   attached to whatever product row or buy record they already keep.
2. **Wire `POST /api/v1/report_outcome`** so their agent reports whether a
   Legibility answer led to a real outcome (buy succeeded at the stated price, or
   it did not).

Two soft asks (wanted, not required to start):

3. A short recurring check-in (15 minutes weekly) with honest feedback on
   misses.
4. A logo or reference later, once value is proven. Never required upfront.

**Decision rule.** If a candidate accepts the two non-negotiables, proceed to
onboarding (section 4). If they will accept only ask 1 (store the id) but not
ask 2 (report outcomes), they are a half-seed: the identity gravity forms but
the flywheel does not ignite. Accept it only if live-partner count is 0 and log
it as `partial_seed`, then keep pushing for outcome wiring at every check-in.
If they refuse both, they are a normal paid customer. Stop the partner motion.

### 3.3 Copy-paste: the design-partner offer message

Send after a successful live demo (`04-demo-and-qualification.md`) and a
scorecard pass. Fill every `{{merge_field}}`. Sweep for em dashes before send.

```
Subject: Legibility design partner slot for {{partner_name}}

{{contact_first_name}},

Based on the read we ran on {{proof_url}} ({{proof_result_summary}}), your
targets are in the slice Legibility serves well today: {{target_domains}}.

I want to offer you a design-partner slot. What you get:

- {{headroom_reads}} trusted reads/mo, free for the partnership. You only ever
  see a read counted when it clears the 0.7 trust gate; nulls and low-confidence
  answers cost nothing.
- A private Slack channel with me directly.
- Your target domains jump the queue if anything returns null or low confidence.

What I ask, and it is the whole point of the partnership:

1. Store the legibility_id we return on each trusted read as a foreign key on your
   side. It is opaque and stable, so it survives the retailer restructuring
   their URLs. One column.
2. When your agent acts on a Legibility answer, call POST /api/v1/report_outcome to
   tell us whether the buy went through at the price we reported. That single
   signal is what makes every future answer on your domains more accurate. It
   is roughly ten lines of code and I will pair with you on it.

Both are small. Together they are the reason to work with us instead of wiring
Firecrawl plus a model yourself.

Want the slot? I can have you returning trusted reads today and reporting
outcomes this week.

{{founder_name}}
```

---

## 4. Integration onboarding runbook

Goal of onboarding: within 2 weeks of yes, the partner is (a) storing
`legibility_id` and (b) POSTing `report_outcome` on real actions. Drive to those
two events. Nothing else in onboarding matters as much.

### 4.1 The `legibility_id`: what it is, why they store it

Every trusted read (confidence >= 0.7) returns an opaque `legibility_id` in the
envelope, shaped `pl_` followed by a random base64url token (for example
`pl_9Fk2Qw7hR3xN...`, 20 random bytes). It is minted at the first trusted read for a
product and reused for every subsequent read of the same product, including
after the retailer changes the URL. It is never derived from the URL or the
GTIN, so a competitor cannot reconstruct or forge it.

Why the partner stores it:

- It is a stable join and dedupe key that outlives URL churn (the audit's
  Allbirds soft-redirect is the failure mode a URL key hits and `legibility_id`
  does not).
- It is the anchor the outcome report joins to, so the loop can attribute a buy
  back to the exact resolved product.
- It is the switching cost. Once it is a foreign key in their schema and their
  data depends on it, no competitor's id can replace it, because none can
  backdate the history accumulated under it.

Integration is one column. Concrete instruction to the partner:

```
Add a nullable text column, e.g. legibility_id, to the table where you already keep
the product you resolved (your product/offer/line-item row). On each trusted
read, write the legibility_id from the response into that column. Treat it as
opaque: do not parse it, do not regenerate it, store it exactly as returned.
```

### 4.2 The outcome report: the endpoint contract (shipped, live)

`POST /api/v1/report_outcome`. Authenticated with the partner's `lgk_` API key
as a Bearer token (the same key they read with). This channel is intentionally
wired hand-in-hand per partner rather than left as a passive endpoint; pair
with them on it.

Request body:

| Field               | Type   | Required         | Notes                                                                                                             |
| ------------------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `outcome`           | string | yes              | One of the enum below.                                                                                            |
| `request_id`        | string | one of these two | The `request_id` returned on the original read. Preferred: it joins straight to the exact call in `usage_events`. |
| `legibility_id`     | string | one of these two | The `pl_...` id from the read. Use when the agent no longer has the request_id but kept the product id.           |
| `observed_price`    | number | no               | The price the agent actually saw at action time. Feeds price-band drift.                                          |
| `observed_currency` | string | no               | ISO currency for `observed_price`.                                                                                |
| `note`              | string | no               | Free text, truncated to 500 chars.                                                                                |

Outcome enum (exact shipped values, use these verbatim):

| Value            | Meaning                                                                        | Closure label                   |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------- |
| `purchased`      | The buy completed at the stated price/availability.                            | positive (Legibility was right) |
| `price_matched`  | Price Legibility reported matched what the agent saw, even without a purchase. | positive                        |
| `price_mismatch` | Price differed from the reported band.                                         | negative (stale/wrong)          |
| `out_of_stock`   | Item was unavailable when the agent acted.                                     | negative (availability miss)    |
| `wrong_product`  | Resolved product was not the intended item.                                    | negative (resolution miss)      |
| `other`          | Anything else; use `note`.                                                     | triage                          |

Responses: `202 {"received": true}` on success. `401` if the key is missing or
invalid. `422 invalid_request` if `outcome` is not in the enum or if neither
`request_id` nor `legibility_id` is present. `400 invalid_json` on a bad body.

### 4.3 Copy-paste: the read-then-report snippet

Give the partner this. It is the entire integration. Fill `{{lgk_key}}`.

```bash
# 1) Read. Keep request_id and legibility_id from the response.
curl -s https://legibility.io/api/v1/read_product \
  -H "authorization: Bearer {{lgk_key}}" \
  -H "content-type: application/json" \
  -d '{"url":"https://{{target_product_url}}"}'
# -> { "product": {...}, "legibility_id": "pl_...", "request_id": "...",
#      "field_confidence": {...}, "cost_usd": ... }

# 2) Act on it (your agent buys / matches / shortlists).

# 3) Report what actually happened.
curl -s https://legibility.io/api/v1/report_outcome \
  -H "authorization: Bearer {{lgk_key}}" \
  -H "content-type: application/json" \
  -d '{
        "request_id": "{{request_id_from_read}}",
        "outcome": "purchased",
        "observed_price": 110.00,
        "observed_currency": "USD"
      }'
# -> 202 {"received": true}
```

Pseudocode for the agent loop, provider-agnostic:

```
resp   = legibility.read_product(url)
store(offer_id, legibility_id = resp.legibility_id)      # ask 1: store the id
result = agent.act_on(resp.product)              # buy / match / shortlist
legibility.report_outcome(                           # ask 2: close the loop
  request_id     = resp.request_id,
  outcome        = map(result),                  # purchased | price_mismatch | ...
  observed_price = result.price_paid,
  observed_currency = result.currency,
)
```

Mapping the partner's result to the enum (give them this rule):

- Buy went through at the quoted price -> `purchased`.
- Did not buy, but the price we quoted was right at action time -> `price_matched`.
- Price was off -> `price_mismatch` with `observed_price`.
- Gone / unavailable -> `out_of_stock`.
- Wrong item entirely -> `wrong_product`.
- Anything ambiguous -> `other` with a `note`.

### 4.4 Onboarding definition of done (verify, do not assume)

Do not mark a partner live until both are observed in the database, not
reported over Slack. Run these against the app Supabase project
(`cgkcplcamsijghalintq`) with the partner's `user_id`.

```sql
-- (a) They store ids AND we can join outcomes to real reads.
--     Confirms at least one outcome report has landed for this partner.
select count(*) as reports,
       count(*) filter (where request_id is not null) as joined_to_read,
       count(*) filter (where legibility_id  is not null) as has_legibility_id
from outcome_reports
where user_id = '{{partner_user_id}}';

-- (b) They are producing trusted reads (there is traffic to close).
select trusted_reads, total_calls
from northstar_weekly(now() - interval '2 weeks')
where user_id = '{{partner_user_id}}';
```

Onboarding is done when (a) `reports >= 1` with `joined_to_read >= 1` and (b)
`trusted_reads > 0`. Until both are true, the partner is still onboarding, no
matter what the demo showed. If 14 days pass without both, escalate per the
stop condition in section 8.

---

## 5. The weekly loop (per live partner)

Run this every week for each live partner. It is a 15-minute check-in plus a
5-minute data pull. The job is to read the three numbers, find the gap, and
close it. This is the mechanism that turns raw outcome reports into a
compounding calibration asset.

### 5.1 The three numbers to pull

Against Supabase `cgkcplcamsijghalintq`, per partner `user_id`.

```sql
-- 1) North Star: weekly trusted reads for this partner (target >= 7/week).
select week, trusted_reads, total_calls
from northstar_weekly(now() - interval '8 weeks')
where user_id = '{{partner_user_id}}'
order by week desc;

-- 2) Gate-pass rate by method on THEIR traffic over 30 days.
--    NOTE: this is how often the gate PASSED, not how often it was RIGHT.
--    Floor is 0.60; below that the thesis is failing regardless of GTM.
select * from trust_rate_by_method(now() - interval '30 days');

-- 3) Outcome closure: the only ground-truth trust signal. Positive vs negative.
select
  count(*)                                                   as reports,
  count(*) filter (where outcome in ('purchased','price_matched'))            as positive,
  count(*) filter (where outcome in ('price_mismatch','out_of_stock','wrong_product')) as negative,
  count(*) filter (where outcome = 'other')                  as needs_triage,
  round(
    count(*) filter (where outcome in ('price_mismatch','out_of_stock','wrong_product'))::numeric
    / nullif(count(*),0), 3)                                 as miss_rate
from outcome_reports
where user_id = '{{partner_user_id}}'
  and created_at >= now() - interval '7 days';
```

### 5.2 Read the numbers, then act (decision rules)

- `reports = 0` this week but `trusted_reads > 0`: the loop is broken. This is
  the top priority. Get on Slack, confirm the `report_outcome` call is firing,
  check for `401`/`422` in their logs. A partner with reads but no reports is
  not yet a moat seed. Escalate if it persists 2 weeks.
- `miss_rate` high and clustered on specific domains: pull the offending
  `request_id`s, add those URLs to the golden set, and put the domain on the
  priority-fix queue. This is the flywheel working: a real miss becomes a
  calibration correction that improves every future answer on that domain.
- `gate_pass_rate` below 0.60 for a method the partner leans on: the engine,
  not the GTM, is failing on their mix. Flag to engineering, and do not push
  volume until it recovers.
- `trusted_reads` trending toward or above 7/week with a healthy positive
  ratio: this partner is proving the North Star. Ask for the logo/reference
  (soft ask 4) and consider them a reference for the next candidate.
- `needs_triage` (`other`) piling up: read the notes, and if a real new outcome
  type recurs, propose it, do not silently overload `other`.

### 5.3 The check-in agenda (paste into the Slack thread)

```
Weekly Legibility check-in, {{partner_name}}, week of {{date}}

1. Volume: {{trusted_reads}} trusted reads this week ({{total_calls}} calls).
2. Closure: {{positive}} good, {{negative}} misses, miss rate {{miss_rate}}.
3. Misses we are fixing: {{domain_1}}, {{domain_2}} on the priority queue,
   ETA {{eta}}.
4. Anything returning null you needed? Send the URLs, they jump the queue.
5. Open question for you: {{one_specific_question}}.
```

---

## 6. Why this is the unmanufacturable moat (say it to yourself, not the prospect)

Every other candidate asset was killed under honest review (see MOAT.md
section 2). Calibration, drift history, identity joins, and even per-domain
reliability curves are all manufacturable in weeks by a funded team using
purchased labels, Common Crawl, and cross-source self-adjudication. Exactly one
label class is not: outcome closure. "The buy succeeded at the stated price and
availability" exists only downstream of a real agent acting on a real Legibility
answer. It cannot be crawled (it is not on any page), cannot be bought (no
vendor sells your customers' buy results), and cannot be self-adjudicated (an
agent that could verify the outcome without buying did not need Legibility).

The compounding is the point. Each `report_outcome` on a legally readable
domain becomes a per-domain, per-method reliability prior that makes every
future answer on that domain measurably better, under an opaque id the partner
has already wired into their schema. A competitor entering after the flywheel
turns starts blind on every domain, cannot backdate the observation history,
and cannot buy the outcome labels at any price. A competitor entering before it
turns simply wins. That is the timer, and this file is the fastest path to
beating it.

Do not pitch the moat to the prospect. Pitch the finished stack and the ten
lines of `report_outcome`. The moat is our reason, not their pitch.

---

## 7. Success criteria (the only scoreboard that counts)

| Milestone   | Definition                                                                                 | Verify                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Seed 1      | >= 1 partner storing `legibility_id` as a FK AND reporting outcomes on a regular cadence.  | `outcome_reports` has rows across >= 2 distinct weeks for one `user_id`; partner confirms the id column exists. |
| Ignition    | Outcome reports flowing weekly, misses feeding golden-set updates and a calibration refit. | `golden_eval_runs` gains a new `calibration_version` fed by partner-sourced misses.                             |
| Seed 2 to 3 | 2 to 3 partners each storing ids and reporting outcomes weekly.                            | 2 to 3 distinct `user_id`s each with multi-week `outcome_reports`.                                              |

Winning signal priority (from `00`, do not reorder): (1) outcome reports
flowing, (2) `legibility_id` stored by partners, (3) fast first-trusted-read
activation, (4) weekly trusted reads trending to 7+. Seed 1 is the single most
important outcome the fleet can produce. Until Seed 1 exists, the moat is a
plan, not an asset.

---

## 8. Stop conditions and kill checks (this motion)

Any one of these is a strategy meeting, not a footnote. Wire the SQL ones into
the weekly loop and `07-metrics-crm-and-loop.md`.

| Condition            | Signal                                                                                               | Action                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Onboarding stalls    | 14 days after yes, not both (id stored AND >= 1 joined outcome report).                              | Escalate to founder. One pairing session. If still stalled at 21 days, downgrade to normal paid and stop concierge spend.     |
| Loop dies            | A live partner logs `trusted_reads > 0` but `reports = 0` for 2 consecutive weeks.                   | Founder Slack, debug the `report_outcome` call. This is the moat leaking. Highest priority.                                   |
| No ignition          | Zero outcome reports across ALL partners for 2 consecutive months after the first partner went live. | KILL CHECK (MOAT dashboard row 5). The moat is running on manufacturable fuel only. Re-examine partner selection and the ask. |
| Nobody stores ids    | 0 accounts with `legibility_id` as a FK 90 days after the id contract shipped.                       | KILL CHECK (row 6). Identity gravity is not forming. Rework onboarding.                                                       |
| Wrong domains        | A partner's query mix is > 50% anti-bot head.                                                        | The flywheel is calibrating unservable domains (dashboard row 4). Re-scope the partner's targets or exit them.                |
| Trust floor breached | `trust_rate_by_method` gate-pass below 0.60, or golden precision-at-gate below floor.                | Engine failing (row 2). Freeze volume growth, escalate to engineering.                                                        |

---

## 9. The 30/60/90 plan (fleet, to reach 2 to 3 partners)

Funnel math to hold the fleet accountable. Assume a conservative conversion:
work ~20 ICP-fit prospects (`01`) to get ~8 live demos to get ~3 scorecard
passes to land ~2 signed design partners. If real conversion is worse, widen
the top, do not lower the bar on the two non-negotiables.

### Days 0 to 30: source, qualify, land Seed 1 into onboarding

- Build the partner pipeline: 20+ scored `design_partner_candidate` records,
  all 3 REQUIRED gates passed on each (section 1).
- Run >= 8 live-read demos on the prospects' real target URLs (never mocked).
- Send >= 3 design-partner offers (section 3.3) to scorecard passes.
- Target exit: 1 partner has said yes and is in onboarding, storing `legibility_id`.
- Weekly fleet metric: candidates added, demos run, offers sent, yes count.

### Days 31 to 60: ignite Seed 1, land Seed 2 into onboarding

- Get partner 1 to onboarding done (section 4.4): both id stored and first
  joined outcome report observed in the database.
- Start the weekly loop (section 5) on partner 1. Feed the first real misses
  into the golden set and trigger the first outcome-fed calibration refit.
- Land partner 2 into onboarding (repeat the 0 to 30 motion, warm pipeline).
- Target exit: partner 1 reporting outcomes weekly (ignition), partner 2
  storing ids.

### Days 61 to 90: reach 2 to 3 reporting partners, institutionalize the loop

- Partner 2 onboarding done and reporting weekly. Partner 3 in onboarding if a
  strong candidate exists; do not force a weak one to hit a number.
- Weekly loop running cleanly on all live partners; misses routinely converting
  to golden-set rows and monthly refits.
- Target exit: 2 to 3 partners each storing ids and reporting outcomes weekly.
  This is the moat ignited within the window.
- Run the section 8 kill checks monthly from here; any red row is a strategy
  meeting.

Throughout: obey `00` guardrails. No fabricated proof, no roadmap sold as
shipped, no em dashes, always lead with a real read. The offer is the finished
stack plus ten lines of `report_outcome`. The moat is our reason for the offer,
never the pitch.
