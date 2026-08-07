# 05 Pricing, Objections, and the Close

This is the deal-making stage of the pipeline. By the time an agent reaches
this file, the prospect has already been qualified in
`04-demo-and-qualification.md` and has seen a real live read on one of their
own target URLs. This file tells an agent exactly which price to quote, when
to switch from a self-serve tier to the design-partner offer, how to answer
every objection with a true response, and how to close and hand off to
onboarding in `06-design-partner-motion.md`.

Every fact here is canonical against `00-operating-brief.md`. If anything in
this file ever conflicts with the CANONICAL FACTS block in `00`, `00` wins.
Do not invent prices, discounts, customers, logos, or proof. No em dashes,
ever.

Last reviewed: 2026-07-06.

---

## 1. Which offer to make (the top-level decision rule)

Run this decision tree first. It decides whether the prospect gets a
self-serve tier or the design-partner offer. This is the single most
important call in the file, because the design-partner path is the only one
that builds the moat (`00` section 1, `MOAT.md`).

```
Is the prospect a moat-critical target?
  = procurement or buy-flow team, on supplier / long-tail / cooperating
    domains (not the anti-bot head), with real buy volume, AND willing in
    principle to store the legibility_id and wire report_outcome?
  -> see 01-icp-and-targeting.md for the scored definition.

  YES -> make the DESIGN-PARTNER OFFER (section 4). Do not lead with a price.
         The commercial ask is outcome-closure wiring, not dollars.

  NO  -> quote a SELF-SERVE TIER by volume (section 2 decision rule).
         Keep the door open: if they later show buy-flow volume on readable
         domains, revisit the design-partner offer.
```

Hard stop before any offer: re-check the three disqualifiers from `00`
section 4. If their targets are majority Amazon / Walmart / Target / Apple,
or the use case is price-tracking / time-series monitoring, or they need live
checkout / inventory feeds / a legal price guarantee, do not quote anything.
Say so plainly and disqualify. Template in section 8.

---

## 2. Pricing (reuse verbatim) and which tier to quote

The trusted-read unit is the whole pricing story: **a null read or a read
below 0.7 confidence charges nothing and consumes no quota.** You only pay for
answers your agent could actually trust. Lead with that line every time.

| Tier    | Price       | Included trusted reads/mo | Overage                | Notes                          |
| ------- | ----------- | ------------------------- | ---------------------- | ------------------------------ |
| Free    | $0, no card | 1,000                     | none, hard stop at cap | key, REST + MCP, email support |
| Starter | $29/mo      | 5,000                     | $0.01/read             | priority email                 |
| Growth  | $199/mo     | 50,000                    | $0.005/read            | higher limits, Slack, SLA      |
| Custom  | quote       | 250,000+/mo               | quote                  | on-prem extractor, residency   |

**Overage honesty rule.** The overage rates above are defined, but automatic
metering to Stripe is not shipped (`00` section 5). Never promise auto-billed
overage as a live feature. In practice today, hitting the cap is a hard stop
or a manual upgrade conversation, not a surprise metered bill. Say it that
way: "you will not get a surprise bill; you hit the cap and we talk."

**Tier-by-volume decision rule.** Estimate the prospect's monthly trusted
reads from the qualifying call (`{{monthly_read_estimate}}`), then:

| Estimated trusted reads/mo                               | Quote                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Under 1,000, evaluating                                  | **Free.** No card. Let the product prove itself.             |
| 1,000 to 5,000                                           | **Starter, $29/mo.**                                         |
| 5,000 to 50,000                                          | **Growth, $199/mo.**                                         |
| Over 50,000, or needs on-prem extractor / data residency | **Custom quote.** Do not name a number; escalate to founder. |
| Any volume, but moat-critical target                     | **Design-partner offer (section 4), not a tier.**            |

Rule of thumb for the quote: quote the tier whose cap comfortably covers
their estimate with headroom, not the tier they will immediately overflow.
A prospect at ~4,500 reads/mo gets Growth quoted as the "you will not think
about the cap" option, with Starter named as the cheaper start.

**Copy-paste tier quote (self-serve path):**

```
Subject: Legibility pricing for {{company}}

Hi {{first_name}},

Based on ~{{monthly_read_estimate}} trusted reads a month on {{use_case}},
the tier that fits is {{tier}} ({{tier_price}}), which includes
{{tier_included}} trusted reads.

The unit matters: a trusted read is a call that came back at 0.7 confidence
or higher. Nulls and low-confidence answers are free and never touch your
quota, so you only pay for answers your agent could actually act on.

Start free with no card (1,000 trusted reads/mo) and move up when you cross
the cap. You will never get a surprise bill: you hit the cap and we talk.

Key + docs: https://legibility.io/docs
```

---

## 3. The hard-domain premium note (read before quoting heavy unlocker use)

Hard retailers (Nike, Lego, MediaMarkt and similar, served via the Bright
Data Web Unlocker) cost Legibility about **$0.005 to $0.006 per successful read**,
versus near-zero for the deterministic paths (Shopify, JSON-LD, barcodes).
That real cost is stamped into every response in `cost_usd`, so this stays
transparent by design. Never hide it.

Decision rules for hard-domain reads:

- **On paid tiers (Starter, Growth):** hard-domain reads count as normal
  trusted reads against the cap. No separate charge in v1. The tier price
  already carries the blended cost.
- **On Free:** allowed, but the 1,000-read hard stop is the protection. Do
  not remove it and do not verbally promise "unlimited" hard-retailer reads.
- **When a prospect's target list is majority hard-domain:** flag it before
  they pay. Apple is still blocked (best-effort, graceful null, no charge).
  Nike, Lego, MediaMarkt are verified working. If most of their catalog is
  the anti-bot head (Amazon/Walmart/Target/Apple), that is a disqualifier,
  not a premium (`00` section 4). Do not sell around it.
- **When quoting Custom or a design partner with heavy unlocker volume:**
  price the unlocker cost in explicitly, and use the per-response `cost_usd`
  as the shared source of truth in that conversation.

---

## 4. The design-partner commercial offer (the real close)

This is the close that matters. For a moat-critical target, do not open with
a price. Open with the trade: free capacity and founder access, in exchange
for outcome-closure wiring and feedback. The dollars are secondary to getting
the `legibility_id` stored and `report_outcome` flowing (`00` sections 1 and 6,
`MOAT.md` ranks 1 and 2).

### 4.1 The standard offer (default terms)

**What we give:**

- **Growth-tier headroom free for 3 months** (50,000 trusted reads/mo),
  extendable by mutual agreement. This is the default `{{N_months}} = 3`.
- Direct founder support and a **private Slack channel** (`{{slack_channel}}`).
- **Priority engineering attention on the partner's target domains.** If a
  domain they need misses today, it goes to the front of the queue.
- Roadmap influence and hands-on help wiring outcome closure.

**What we ask (the two non-negotiables plus two soft asks):**

1. **Store the opaque `legibility_id`** as a foreign key in their own database.
   (Non-negotiable. This is where switching cost forms.)
2. **Wire `POST /api/v1/report_outcome`** so their agent reports whether a
   Legibility answer led to a real purchase at the stated price and availability.
   (Non-negotiable. This is the moat's only unmanufacturable label.)
3. Regular feedback on misses, a short recurring check-in (default weekly for
   the first month, then every two weeks).
4. A logo or a reference later, once value is proven. Not required upfront,
   never a gate on starting.

If the prospect will not commit to (1) and (2) even in principle, they are not
a design partner. Offer them a self-serve tier instead and move on. The free
capacity is bought with the wiring; without the wiring there is no deal to
discount.

### 4.2 The guardrail (cap free hard-domain reads)

The 50,000-read free headroom is deterministic-path economics. Hard-domain
(unlocker) reads cost real money per call, so cap them inside the free
window to avoid funding a large unlocker bill on our side:

- **Cap free hard-domain reads at 2,000/mo** during the design-partner free
  period (`{{hard_domain_cap}} = 2000`). Deterministic reads (Shopify,
  JSON-LD, barcodes) stay uncapped up to the 50,000 Growth headroom.
- If their real buy-flow needs more than 2,000 hard-domain reads/mo, that is
  a signal to move the conversation to a Custom commercial (section 2), not a
  reason to silently absorb the cost. The `cost_usd` field makes the number
  concrete for that talk.
- State the cap plainly in the offer. It is not a trick; it is the honest
  shape of the economics.

### 4.3 Copy-paste design-partner offer

```
Subject: Design-partner spot on Legibility for {{company}}

Hi {{first_name}},

You saw the live read on {{proof_url}}: {{proof_object_summary}}, with
per-field confidence and the cost stamped in. That is the exact shape your
{{use_case}} needs, and {{their_target_domain}} is in the slice we serve
today.

I want to make you a design partner rather than sell you a tier. Here is the
trade, plainly:

What you get:
- Growth headroom free for {{N_months}} months: 50,000 trusted reads a month,
  extendable. Nulls and low-confidence reads stay free and off-quota.
- A private Slack channel with me and direct founder support.
- Your target domains at the front of the engineering queue.

What I ask:
- Store the opaque legibility_id we return as a foreign key in your own database.
- Wire POST /api/v1/report_outcome so your agent tells us when a Legibility answer
  led to a real buy at the stated price. That single signal is what makes the
  confidence numbers get better on your domains specifically.
- A short weekly check-in on any misses for the first month.
- A logo or reference later, only once it has clearly earned it.

One honest note on the economics: hard-retailer reads through our unlocker
(Nike, Lego, MediaMarkt and similar) cost us real money per call, so the free
window caps those at {{hard_domain_cap}}/mo. Deterministic reads (Shopify,
JSON-LD, barcodes) are uncapped up to the 50k. If your volume on hard
retailers runs higher, we size a proper commercial around it, using the
per-call cost we already stamp into every response.

If that trade works, I will open the Slack channel and send the wiring steps
today. Onboarding is about 30 minutes.
```

---

## 5. Objection matrix (agent-ready responses)

Each row: the objection, the true underlying worry, the response to give, and
the stop condition (when to stop pushing and either disqualify or hand back to
self-serve). Every response must be true against `00`. Where a claim is
roadmap or best-effort, say so.

### 5.1 "We can just build this with Firecrawl + GPT"

**Worry:** build-vs-buy. They have the raw pieces and an engineer who could
wire them.

**Response:** They can, and they will then own every hard part, not the easy
one. Firecrawl plus a model gets you a scrape and a JSON blob. What you do not
get, and what is the actual work, is: a stable typed schema across sites, a
7-day cache keyed to survive site restructures, a **calibrated** confidence
per field (not a self-reported number, an actual probability you can gate on),
the barcode merge, the is-product verifier that refuses 404s and homepages,
the MCP server, x402, an opaque stable identity, and the cost stamped per
call. Legibility is that stack finished behind one call, and you only pay when a
read clears the 0.7 gate. The two things that are genuinely hard to reproduce
are calibrated confidence and outcome closure, and those are exactly what a
weekend Firecrawl wrapper does not have.

**Copy-paste:**

```
You can build it, and then you own the schema, the cache, the barcode merge,
the is-product verifier, the MCP server, x402, a stable identity, and the
part that actually takes time: a calibrated confidence per field that you can
gate on, not a number the model made up. We are that stack finished behind
one call, and we only bill when the read clears 0.7. Cost is stamped on every
response, so the build-vs-buy math is right there in the payload. Want me to
run your five hardest URLs through both so you can compare the confidence?
```

**Stop condition:** if they are a scraping-infra team whose product IS the
extractor, they are a competitor-adjacent build, not a buyer. Disqualify
politely.

### 5.2 "Why not just use Diffbot?"

**Worry:** an incumbent already returns typed product objects.

**Response:** Diffbot returns a typed object, and for a raw entity graph it is
strong. What it does not do: it does not return a **calibrated per-field
confidence** you can gate on, it does not stamp the per-call cost into the
response, it has no MCP surface, and it does not accept x402, so an agent
cannot discover it and pay for it on its own. Legibility is built to be called by
an agent and to tell that agent how much to trust each field. If you want a
246M-entity knowledge graph, Diffbot. If you want a typed answer your agent
can gate on and pay for autonomously, Legibility.

**Copy-paste:**

```
Diffbot is a real product and their entity graph is deep. The difference for
an agent: Diffbot gives you a typed object but not a calibrated confidence
per field, no per-call cost in the response, no MCP tool, and no way for the
agent to pay on its own. Legibility is built to be called and trusted by an
agent: confidence you gate on per field, cost stamped in, MCP live at
/api/mcp. Different job. Happy to show the same URL through both.
```

**Stop condition:** if they need a broad entity/knowledge graph across
non-commerce data, that is Diffbot's job, not Legibility's. Do not oversell.

### 5.3 "Apple doesn't work" / "it failed on the retailer I care about"

**Worry:** they tested a hard site and got a null.

**Response:** Be honest first, then redirect to what works on their catalog.
Apple and a few top-tier anti-bot sites are best-effort today: they return a
graceful null with no charge, not a wrong answer. What does work today,
live-verified: Shopify storefronts, barcodes/GTIN, cooperating JSON-LD and
strong OpenGraph, and hard retailers through the unlocker (Nike, Lego,
MediaMarkt verified). The right move is to run their actual target list and
show the real hit rate, not argue about Apple. If their list is majority
anti-bot head, that is a disqualifier and you say so.

**Copy-paste:**

```
Straight answer: Apple and a handful of top anti-bot sites are best-effort
right now. They come back as a clean null with no charge, never a wrong
answer. What returns real objects today: Shopify, barcodes, cooperating
JSON-LD, and hard retailers through our unlocker (Nike, Lego, MediaMarkt are
verified). Send me your 10 most important target URLs and I will run them and
show you the real hit rate before you commit to anything.
```

**Stop condition:** if the majority of their real target URLs are
Amazon/Walmart/Target/Apple, disqualify (`00` section 4). Do not promise a
roadmap fix for the anti-bot head.

### 5.4 "Is the price live? Is it real-time?"

**Worry:** they think a stale price will break their buy-flow.

**Response:** Legibility returns a price **band** with an `as_of` timestamp and
the number of sources, not a live spot price, and that is honest by design. A
band plus a timestamp is a truthful thing to gate on. If you need a guaranteed
live spot price at the moment of purchase, that is a checkout-time call to the
merchant, and Legibility does not claim to replace it. For comparison, ranking,
and shortlisting, the band is exactly the right primitive. If they need a
legal price guarantee, that is a disqualifier.

**Copy-paste:**

```
It is a band, not a live spot price, and we return it with an as_of timestamp
and the source count so you can see its freshness. That is deliberate: we
would rather hand you an honest band than a single number we cannot stand
behind between crawl and click. For shortlisting and comparison it is the
right primitive. If your flow needs a guaranteed live price at the instant of
purchase, that is a merchant checkout call, and we do not pretend to replace
it.
```

**Stop condition:** if they require a contractual/legal price guarantee,
disqualify (`00` section 4).

### 5.5 "How do I trust the confidence number? / data freshness and accuracy"

**Worry:** vendor confidence numbers are usually decoration.

**Response:** The confidence is a **calibrated probability against a labelled
golden set**, not a coverage proxy or a model's self-report. Calibrated means
0.7 is about 70% likely correct, and you get it per field, so you set your own
threshold: hard-gate at 0.9 on `gtin`, accept 0.6 on `category`. You are not
trusting our number, you are trusting your own threshold applied to a
calibrated number. On freshness, every response carries `as_of` and the source
method, so you always know how the answer was derived and how old it is. And
the design-partner mechanism makes this concrete: once you wire
`report_outcome`, the confidence on your specific domains gets better because
it learns from whether your buys actually succeeded.

**Copy-paste:**

```
The confidence is calibrated against a labelled golden set, so 0.7 really
means about 70% likely correct, and you get it per field. You do not trust
our number, you pick your own gate: 0.9 on gtin, 0.6 on category, whatever
your flow needs. Every response also carries as_of and the source method, so
freshness is never a mystery. And if you become a design partner and wire
report_outcome, the confidence on your domains specifically improves, because
it learns from whether your buys actually landed.
```

**Stop condition:** none; this is a core strength. If they push for a formal
accuracy SLA, note that an audited trust-rate SLA is post-traction contract
furniture, not a today claim, and do not promise it.

### 5.6 "x402 / Base Sepolia sounds risky"

**Worry:** they think crypto payment is a dependency.

**Response:** It is testnet only (Base Sepolia), fully opt-in, and you can
ignore it entirely and pay with a card. No live mainnet settlement has
happened. The agent-pays-directly surface is a bonus for autonomous stacks,
not a dependency for anyone. Card is the default and only real payment path.

**Copy-paste:**

```
x402 is opt-in and testnet only today (Base Sepolia). No mainnet settlement
has happened, and you never have to touch it: card is the default and only
real payment path. The agent-pays-over-x402 surface is a bonus for fully
autonomous stacks, not something you depend on.
```

**Stop condition:** if they want to pay primarily via x402 on mainnet today,
that is not shippable; the corpus also warns against x402-first adopters as a
primary segment. Steer to card and note mainnet is roadmap.

### 5.7 "Do you have webhooks / SDKs?"

**Worry:** integration ergonomics.

**Response:** Be honest: webhooks, SDKs, and auto-billed overage are roadmap,
not shipped. Do not sell them. What ships today is REST (all four tools) and
MCP (`read_product` and `resolve_product`). `compare_products` and
`brief_product` are REST-only. Most agent integrations need a synchronous call
and a typed response, which is exactly what ships.

**Copy-paste:**

```
Honest answer: webhooks and SDKs are roadmap, not shipped, so I will not sell
them to you. What ships today is REST for all four tools and MCP for read and
resolve, which is a synchronous call and a typed response, which is what an
agent integration actually needs. If webhooks become a blocker for you, tell
me and I will factor it into the roadmap conversation.
```

**Stop condition:** if a webhook or an official SDK is a hard requirement to
adopt, note it as roadmap and do not fabricate a date.

### 5.8 "The free tier is too small" / "it's too expensive"

**Worry:** price sensitivity, or genuine volume above the tier.

**Response:** Reframe on the trusted-read unit: they are not paying for calls,
they are paying for answers that cleared 0.7, and everything below that is
free. Re-estimate their real trusted-read volume (a chunk of their raw calls
will be nulls and low-confidence, which cost nothing). Then quote the tier
that fits. If they are genuinely high-volume and buy-flow-shaped, that is a
design-partner conversation, not a discount conversation.

**Copy-paste:**

```
Worth re-checking the number, because you only pay for reads that cleared 0.7.
The nulls and the low-confidence answers in your traffic are free and never
touch quota, so your billable volume is usually a good bit lower than your raw
call count. On that basis {{tier}} likely covers you. And if you are running
real buy-flow volume on readable domains, the better path is not a discount,
it is a design-partner spot with free Growth headroom. Want me to size both?
```

**Stop condition:** do not discount self-serve tiers below list. The lever for
a serious prospect is the design-partner offer (free headroom for wiring), not
a lower sticker. If they only want a cheaper sticker and will not wire outcome
closure, hold the line and let them start on Free.

### 5.9 "Who else uses this? / no logos"

**Worry:** social proof, early-stage risk.

**Response:** Be straight: Legibility is early and in private beta, which is
exactly why the design-partner spots exist and why the terms are generous. Do
not invent customers or logos (hard rule, `00` section 7). Sell the trade and
the founder access, not a customer list you do not have.

**Copy-paste:**

```
Straight answer: we are early and in private beta, which is why design-partner
spots are open and the terms are this generous. I am not going to wave logos
at you that do not exist. What I can offer is direct founder access, your
domains prioritized, and free Growth headroom in exchange for wiring outcome
closure. If early is a dealbreaker for you, no problem, start on Free and come
back when it is not.
```

**Stop condition:** if they require established-vendor references to proceed,
they are not a beta design partner. Offer Free and revisit later.

---

## 6. Discount and negotiation rules (hard limits)

- **Do not discount self-serve list prices.** Starter is $29, Growth is $199.
  The concession lever is the design-partner offer, not a cheaper sticker.
- **The design-partner offer is the discount.** Free Growth headroom for
  `{{N_months}}` months is already the deep concession. It is bought with the
  outcome-closure wiring, not given away.
- **Never extend the free window without the wiring in place.** If a partner
  wants more free time, the ask is: is `report_outcome` flowing and is the
  `legibility_id` stored? If yes, extending is easy. If no, there is nothing to
  extend.
- **Custom / on-prem / residency: do not name a number.** Escalate to founder.
- **Never promise roadmap as a term.** Not Apple coverage, not webhooks, not
  mainnet x402, not SDKs, not auto-billed overage.

---

## 7. The close

Two closing motions, by path.

**Self-serve close (fits a tier).** The close is "start free, no card, and
move up when you cross the cap." Lower the activation barrier to zero.

```
Easiest next step: grab a key at https://legibility.io, no card, 1,000 trusted
reads a month to prove it on your own URLs. When you cross the cap we move you
to {{tier}}. Docs and the MCP endpoint are at /docs and /api/mcp. Want me to
send a 5-line curl that reads {{their_target_domain}} right now?
```

**Design-partner close (moat-critical).** The close is a yes to the trade and
a same-day Slack channel. The commitment you are closing is the wiring, not a
signature.

```
If the trade works for you, say yes and I will open the Slack channel today
and send the two wiring steps: store the legibility_id, and call report_outcome
on real buys. Onboarding is about 30 minutes and I will be in the channel
while you do it. Good to start?
```

Ask for the specific yes. For self-serve: "want the curl / want me to send the
key steps?" For design partner: "good to start today?" Do not end a qualified
conversation without a concrete next action and an owner.

---

## 8. Stop conditions and the honest no

Disqualify cleanly when a disqualifier is true. A fast honest no protects the
North Star (calls on domains Legibility cannot serve poison the calibration) and
protects trust.

**Copy-paste disqualification (hard-domain head):**

```
Being straight with you: your target list is mostly {{disqualifying_domains}},
which are top-tier anti-bot sites we do not serve reliably today, and I would
rather tell you now than take your money for nulls. If your mix shifts toward
Shopify, structured retailers, barcodes, or supplier catalogs, come back and
I will run them live. Not the right fit right now.
```

**Copy-paste disqualification (price-tracking / live-guarantee use case):**

```
Honest fit check: Legibility returns a price band with a timestamp, not a live
guaranteed spot price or a time-series price feed, and we deliberately do not
serve price-monitoring use cases. So this is not the right tool for
{{use_case}}. If your need is typed product data for a buy or compare flow on
readable domains, that is exactly us, and I am happy to run a live read.
```

Other stop conditions:

- Prospect will not commit even in principle to storing the `legibility_id` and
  wiring `report_outcome` -> not a design partner. Offer Free/Starter and move
  on.
- Prospect wants only a cheaper self-serve sticker and no wiring -> hold list
  price, let them start on Free.
- Prospect requires a signed accuracy SLA, established logos, or a webhook to
  proceed -> note as roadmap / post-traction, offer Free, revisit later.

---

## 9. Handoff to onboarding

When a design partner says yes, the deal is not done, the wiring is the deal.
Hand straight off to `06-design-partner-motion.md` and do not consider the
partner landed until the two non-negotiables are live:

1. The opaque `legibility_id` is stored as a foreign key in their schema.
2. `POST /api/v1/report_outcome` is firing on real buys.

Onboarding owns: opening the Slack channel, walking the two wiring steps,
confirming the first trusted read (activation, target under 3 minutes), and
setting the weekly feedback cadence. The North Star and the CRM update that
follows live in `07-metrics-crm-and-loop.md`.

The moat does not start when they sign. It starts when `report_outcome` first
fires. Close toward that event, not toward the yes.

---

## Guardrails (every message, every time)

- No em dashes, ever. Commas, periods, colons, or "to" for ranges.
- No fabricated proof: no invented customers, logos, metrics, or discounts.
- Never promise roadmap as shipped: not Apple, webhooks, mainnet x402, SDKs,
  or auto-billed overage.
- Always ground the close in a real live read on the prospect's own target.
- State honest limits proactively: band not live price, x402 testnet, hard
  retailers best-effort with a graceful null, overage not auto-billed.
- The concession lever is the design-partner offer, not a lower sticker price.
