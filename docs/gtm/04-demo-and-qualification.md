# 04 Demo and Qualification

The demo and qualify stages of the pipeline in `00-operating-brief.md`. This
file is executable: an agent or a founder runs it top to bottom on a real
prospect and produces a verdict without a human in the loop. Every demo beat
is a live call that returns today. Never mock. If anything here conflicts with
a claim you remember, the CANONICAL FACTS in `00-operating-brief.md` win.

Ladders to: prospect and personalize are done (`01`, `02`, `03`). This file
takes a prospect who replied or booked, proves value on their own catalog,
qualifies them against the gates, and routes them to `05` (close) or `06`
(design-partner motion) or drops them.

Last reviewed: 2026-07-06.

---

## 0. Prereqs the agent loads before any demo

Set these once. Do not run a demo without them.

| Var | Value | Note |
|---|---|---|
| `{{LEGIBILITY_HOST}}` | `https://legibility.io` | If DNS has not propagated, fall back to `https://legibility.io`. Both serve the same prod. |
| `{{LEGIBILITY_API_KEY}}` | a live `lgk_...` key | From the demo account. Keyed calls are metered; use the demo account, not a partner's. |
| `{{MCP_URL}}` | `{{LEGIBILITY_HOST}}/api/mcp` | JSON-RPC 2.0. Discovery is free, `tools/call` is paid. |
| `{{DOCS_URL}}` | `{{LEGIBILITY_HOST}}/docs` | Send after the demo, not during. |

Hard rules for this stage (from `00` section 7, do not violate):

- No em dashes anywhere in anything you send. Use commas, periods, colons, or
  "to" for ranges.
- No fabricated proof. Every object you show came back from a live call you
  just ran. Never paste a hand-written object.
- Never sell "any URL," webhooks, mainnet x402, SDKs, Apple coverage, or
  auto-billed overage. State them as roadmap or best-effort if asked.
- Always lead with a real read. If you have not run a live call on one of the
  prospect's own URLs, you are not ready to talk to them.

---

## 1. The killer open: demo on their own catalog before the call

The move that wins the meeting is showing the prospect their own products
already coming back typed, before they have spent a minute with you. Do this
during personalization (`02`, `03`) and again to open the live call.

### 1.1 Procedure (run this, capture the output)

1. Pull 3 product URLs from `{{prospect_domain}}`. Prefer their highest-value
   or most-linked SKUs. If they operate on supplier or long-tail domains
   (the moat-critical subset), pull URLs from those, not from a consumer head.
2. Run `read_product` on each with your demo key:

```bash
curl -s -X POST {{LEGIBILITY_HOST}}/api/v1/read_product \
  -H "Authorization: Bearer {{LEGIBILITY_API_KEY}}" \
  -H "Content-Type: application/json" \
  -d '{"url":"{{their_product_url_1}}"}'
```

3. Record for each URL: `confidence`, `method`, `price` band, `legibility_id`,
   `cost_usd`, and whether it cleared the 0.7 gate (`product` present AND
   `confidence >= 0.7`).

### 1.2 Decision table on the 3-URL pre-check

| Trusted reads (>= 0.7) | Read of the situation | Action |
|---|---|---|
| 3 of 3 | Their catalog is squarely in coverage. | Open with all three. Book or run the full demo. Strong lead. |
| 2 of 3 | Mostly reachable, one miss. | Open with the two hits. Check the miss (section 1.3). Proceed. |
| 1 of 3 | Marginal. Coverage depends on which domains they actually care about. | Ask which domains carry their real volume before promising anything. If their priority domains are the reachable ones, proceed. If not, likely disqualify. |
| 0 of 3, misses are anti-bot heads | Amazon, Walmart, Target, Apple, or similar. | DISQUALIFY on disqualifier 1 (section 4.2). Do not run a demo. Send the honest-no template (`05`). |
| 0 of 3, misses are reachable domains | Should have worked (JSON-LD, Shopify, GTIN, cooperating catalogue). | Do NOT demo on a broken result. Escalate to founder: this is a possible product miss, not a prospect signal. Log it for the eval corpus. |

### 1.3 Classifying a single miss

A `product: null` with a below-gate `confidence` is not always a Legibility
failure. Classify before you react:

- Anti-bot head (Apple and a few top-tier sites): expected. Graceful null, no
  charge. This is the honest limit, say so.
- Reachable domain that returned null: unexpected. Flag to founder, add the
  URL to the eval set. Do not paper over it.
- Non-product URL (category page, homepage, 404): user error on URL selection.
  Pick a real product URL and re-run.

### 1.4 Pre-call artifact (copy-paste, merge fields)

Send this only when at least 2 of 3 came back trusted.

```
Subject: {{prospect_company}} products, already typed

{{first_name}},

Before we talk, here are 3 of your own product pages run through Legibility
just now, untouched:

1. {{their_product_url_1}}
   -> {{title_1}} | {{price_band_1}} | confidence {{confidence_1}} | via {{method_1}}
2. {{their_product_url_2}}
   -> {{title_2}} | {{price_band_2}} | confidence {{confidence_2}} | via {{method_2}}
3. {{their_product_url_3}}
   -> {{title_3}} | {{price_band_3}} | confidence {{confidence_3}} | via {{method_3}}

Each came back as a typed object with a calibrated confidence per field and
the exact cost of the call stamped in. One call, REST or MCP. You only pay
when a read clears the 0.7 trust gate, so nulls are free.

15 minutes to run this live on the SKUs your agent actually hits?

{{sender_name}}
```

Stop condition: if you cannot produce at least 2 trusted reads on their real
domains, you do not have a demo. Route to the disqualify or escalate path
above. Do not book time to show a weak result.

---

## 2. The live demo script (five beats, every beat a real call)

Run this on the call, live, in a terminal or an agent session they can see.
Total time 8 to 12 minutes. Each beat is a single call and one sentence.

### Beat 1: their own URL, typed in one call

```bash
curl -s -X POST {{LEGIBILITY_HOST}}/api/v1/read_product \
  -H "Authorization: Bearer {{LEGIBILITY_API_KEY}}" \
  -H "Content-Type: application/json" \
  -d '{"url":"{{their_product_url_1}}"}'
```

Representative response (Shopify path):

```json
{
  "request_id": "req_7k2f...",
  "input": { "url": "{{their_product_url_1}}" },
  "product": {
    "title": "Men's Wool Runner",
    "brand": "Allbirds",
    "sku": "MENS_WOOL_RUNNERS",
    "price": { "low": 110, "high": 110, "currency": "USD", "as_of": "2026-07-06T...", "n_sources": 3 },
    "availability": "in_stock",
    "attributes": {}
  },
  "legibility_id": "pl_9d3a1c...",
  "field_confidence": { "title": 0.90, "brand": 0.98, "price": 0.98 },
  "confidence": 1.0,
  "method": "jsonld",
  "calibration_version": "iso-63-2026-07-05",
  "sources": ["{{their_product_url_1}}"],
  "cost_usd": 0.003,
  "cached": false,
  "as_of": "2026-07-06T..."
}
```

Say: "That is your product page, in one call, as a typed object your agent can
branch on. Confidence per field, a price band with sources, a stable id, and
the cost of the call stamped in."

### Beat 2: a barcode, no URL needed

```bash
curl -s -X POST {{LEGIBILITY_HOST}}/api/v1/read_product \
  -H "Authorization: Bearer {{LEGIBILITY_API_KEY}}" \
  -H "Content-Type: application/json" \
  -d '{"gtin":"5449000000996"}'
```

Representative response (barcode path, note price can be null while the read is
still trusted on identity):

```json
{
  "product": {
    "title": "Coca-Cola 330ml",
    "brand": "Coca-Cola",
    "gtin": "5449000000996",
    "price": null,
    "availability": null,
    "attributes": {}
  },
  "legibility_id": "pl_2f81be...",
  "field_confidence": { "title": 0.9, "brand": 0.92, "gtin": 0.99 },
  "confidence": 0.78,
  "method": "gtin",
  "cost_usd": 0.003,
  "cached": false
}
```

Say: "Same tool, a barcode instead of a URL. If your agent has a GTIN, it does
not need a page. Notice price is null here and the read is still trusted on
identity, because the confidence is per field, not one blunt number."

### Beat 3: a fuzzy name, resolved synchronously

```bash
curl -s -X POST {{LEGIBILITY_HOST}}/api/v1/resolve_product \
  -H "Authorization: Bearer {{LEGIBILITY_API_KEY}}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sony WH-1000XM5"}'
```

Say: "A fuzzy product name, no URL, no id. It runs neural retrieval then
extraction and returns the resolved object in the same response. No job to
poll." Honest note if it returns a null envelope: name-resolve depends on Exa
credits; when they are out it returns a graceful null, not an error. If that
happens live, fall back to a URL read and flag it as a credit state, not a
failure.

### Beat 4: the agent-native surface (MCP)

First show discovery is free:

```bash
curl -s -X POST {{MCP_URL}} \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Then a keyed, metered call that returns the same envelope:

```bash
curl -s -X POST {{MCP_URL}} \
  -H "Authorization: Bearer {{LEGIBILITY_API_KEY}}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_product","arguments":{"url":"{{their_product_url_1}}"}}}'
```

Optional, only if they build autonomous paying agents: show the no-key call
returning `HTTP 402` with x402 `PaymentRequirements`, so an agent can pay
without a human. Flag it honestly: "x402 is live on Base Sepolia testnet. No
mainnet settlement yet. Card is the default and only real payment path today.
This is a bonus surface, not a dependency."

### Beat 5: the money shot (confidence, cost, id, and the moat teaser)

Point at three fields in the Beat 1 response and land them:

- `confidence: 1.0` with `field_confidence`: "Calibrated. 0.7 means about 70%
  likely correct, measured on a held-out golden split. You gate on it: accept
  0.9 on gtin, tolerate 0.6 on category. Most vendors give you one number or
  none."
- `cost_usd: 0.003`: "The price of the call is in the call. Build-versus-buy
  math is trivial, and you only pay when a read clears 0.7, so nulls and
  low-confidence answers are free and burn no quota."
- `legibility_id: pl_...`: "An opaque, stable id for this product, never derived
  from the URL. Store it as a foreign key in your schema. Then when a Legibility
  answer leads to a real buy, your agent posts one line back:"

```bash
curl -s -X POST {{LEGIBILITY_HOST}}/api/v1/report_outcome \
  -H "Authorization: Bearer {{LEGIBILITY_API_KEY}}" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"purchased","legibility_id":"pl_9d3a1c...","observed_price":110,"observed_currency":"USD"}'
```

Say: "That call is never billed. It is the whole point of the design-partner
program. It closes the loop so the confidence keeps getting better on the
domains you actually buy from. Nobody else can produce that data, because it
only exists downstream of your agent acting on a real answer." This is the
bridge into `06`. Do not oversell it as a feature they must adopt today; it is
the ask you make if they qualify as a design partner.

### 2.1 Demo run sheet

| Beat | Call | Proof it makes | Time |
|---|---|---|---|
| 1 | `read_product` on their URL | Their catalog is typed in one call | 2 min |
| 2 | `read_product` with `gtin` | No URL needed, per-field confidence | 1 min |
| 3 | `resolve_product` with `name` | Fuzzy name in, object out, synchronous | 2 min |
| 4 | MCP `tools/list` then keyed `tools/call` | Agent-native surface, discovery free | 2 min |
| 5 | Point at confidence, cost, `legibility_id`, `report_outcome` | Trust gate, transparent cost, the moat | 3 min |

### 2.2 Never do in a demo

- Never demo on `example-store.com` or a bot-hard head (Amazon, Walmart,
  Target, Apple). Use a URL that returns a trusted object today.
- Never present a null as a success. If a live call misses, classify it
  (section 1.3) and say what it is.
- Never claim webhooks, SDKs, mainnet x402, Apple coverage, or auto-billed
  overage exist.

---

## 3. Discovery questions (each maps to a signal and a score)

Ask these on the call, after Beat 1 has earned attention. Score each row 0, 1,
or 2. You are testing the three gates and outcome-wireability, not making
conversation.

| # | Question | Testing | Good answer (2) | Kill answer (0) |
|---|---|---|---|---|
| 1 | "Walk me through where your agent reads a product today. What breaks?" | Gate 1: real programmatic buy-flow | An agent/automation consumes product data in code; the read is the flaky part | It is a human dashboard; nobody consumes a typed schema |
| 2 | "What do you spend on extraction or scraping now: Diffbot, Firecrawl, ScrapingBee, Playwright, Browserless, hand-rolled JSON-LD?" | Gate 2: budget and pain exist | Named vendor and a monthly line, or heavy in-house upkeep | Nothing, no pain, no budget, not looking |
| 3 | "Which domains carry your real volume? Name the top five." | Gate 3 and disqualifier 1: reachable vs anti-bot head | Shopify, JSON-LD retailers, barcodes, supplier or long-tail catalogues | Majority Amazon, Walmart, Target, Apple |
| 4 | "Roughly how many product reads per month across your agents?" | Volume gate (1k+/mo potential) | 1,000+ now or a clear near-term path to it | A handful, hobby volume, no growth path |
| 5 | "How do you handle confidence today when a read looks wrong?" | Wedge strength | "We do not," or brittle heuristics they hate | Solved and happy, no need to gate |
| 6 | "Is this for lookup and comparison, or does the agent place real orders and track price over time?" | Disqualifier 2 and 3 | Lookup, compare, buy-decision support | Price time-series tracker, or needs live checkout / stock feed / price guarantee |
| 7 | "When your agent acts on a read and a purchase happens, could you post a one-line outcome back and store an id we give you?" | Outcome-wireability (design-partner fit) | Yes, they control the agent code and see real buys | No, they cannot touch the code path or never see outcomes |
| 8 | "Who pays: a human with a card, or an agent over x402?" | Payment path, x402 relevance | Either; card is fine | (not scored, informational) |

Scoring rule:

- Any row 1, 3, or 6 that lands on a kill answer triggers the matching
  disqualifier in section 4.2. Stop and route to the honest-no.
- Rows 1 to 4 are the gates. All four must score at least 1 to proceed.
- Row 7 at 2 with the gates passed is a design-partner candidate: route to
  `06`. Row 7 at 0 can still be a paying customer: route to `05`, do not make
  the partner ask.

---

## 4. Qualification gates and disqualifiers

Run this after discovery. It is a checklist, not a judgement call.

### 4.1 The three gates (all three must be true)

| Gate | Passes when | Evidence to capture |
|---|---|---|
| G1 real buy-flow | They build an agent or automation that consumes product data in code and wants a typed schema | Q1 = 2, and they described the code path |
| G2 real spend / pain | They already pay for extraction/scraping/headless or hand-roll JSON-LD | Q2 named a vendor or in-house cost |
| G3 reachable domains | Their priority domains are majority reachable today (JSON-LD, Shopify, GTIN, cooperating catalogues, supplier long-tail) | Q3 plus the 3-URL pre-check: at least 2 of 3 trusted on their real domains |

Add the volume gate as a fourth check: their realistic monthly read volume is
1,000+ or has a clear near-term path there (Q4). Below that with no growth
path, they are a Free-tier user, not a sales-worked account. Keep them, do not
work them.

### 4.2 The three disqualifiers (any one kills the deal)

| Disqualifier | Trips when | What to do |
|---|---|---|
| D1 anti-bot head | Target domains are majority Amazon, Walmart, Target, Apple, or similar top-tier anti-bot heads | Say it plainly: Legibility cannot serve those reliably today. Send honest-no (`05`). Do not pretend. |
| D2 price tracker | The use case is price-tracking or time-series price monitoring | Decline on principle: legal risk on live-price claims, willingness to pay too low, it is the segment Legibility refuses. |
| D3 out of scope | They need live checkout / order placement, inventory or stock feeds, or a legal guarantee on price | Out of scope in v1. Do not sell it. Offer to revisit if the roadmap reaches it. |

### 4.3 Outcome-wireability (the moat check)

This does not gate a paying deal, it gates the design-partner offer. Assess:

- Can they store the opaque `legibility_id` as a foreign key in their own schema?
  (They control their data model.)
- Can they call `POST /api/v1/report_outcome` on real buys? (They control the
  agent's action path and see purchase outcomes.)
- Do they operate on supplier or long-tail domains where outcome data is
  legally readable and highest-value? (The moat-critical subset.)

All three yes plus gates passed: this is a design-partner target. Route to
`06`, make the partner offer. Any no: fine paying customer, route to `05`.

---

## 5. Verdict and routing (copy-paste, fill and log)

Produce this after the demo. It is the handoff artifact to `05` or `06`.

```
LEGIBILITY QUALIFICATION VERDICT

Prospect: {{prospect_company}} / {{first_name}} ({{role}})
Domain(s): {{prospect_domain}}, {{supplier_or_longtail_domains}}
Date: {{date}}

Pre-check (3 URLs on their catalog):
  trusted reads: {{n}}/3  |  methods: {{methods}}  |  best confidence: {{c}}

Gates:
  G1 real buy-flow ........ {{pass/fail}}  ({{evidence}})
  G2 real spend / pain .... {{pass/fail}}  (vendor: {{current_vendor}}, spend: {{spend}})
  G3 reachable domains .... {{pass/fail}}  (pre-check {{n}}/3)
  Volume 1k+/mo ........... {{pass/fail}}  (est: {{monthly_read_estimate}})

Disqualifiers:
  D1 anti-bot head ........ {{tripped/clear}}
  D2 price tracker ........ {{tripped/clear}}
  D3 out of scope ......... {{tripped/clear}}

Outcome-wireability (moat):
  can store legibility_id ..... {{yes/no}}
  can call report_outcome . {{yes/no}}
  legally-readable domains  {{yes/no}}

VERDICT: {{DESIGN PARTNER | PAYING PROSPECT | FREE-TIER SELF-SERVE | DISQUALIFIED}}
ROUTE TO: {{06 design-partner motion | 05 close | keep on Free | drop}}
NEXT ACTION: {{one concrete step, owner, date}}
```

### 5.1 Routing decision rule

| Condition | Verdict | Route |
|---|---|---|
| Any disqualifier tripped | DISQUALIFIED | Drop. Send honest-no (`05`). Log the reason. |
| All gates pass + all outcome-wireability yes | DESIGN PARTNER | `06`. Make the partner offer. |
| All gates pass + outcome-wireability partial or no | PAYING PROSPECT | `05`. Move to pricing and close. |
| G1 or G2 pass but volume below 1k with no path | FREE-TIER SELF-SERVE | Keep on Free, send `{{DOCS_URL}}`, do not work. |
| G3 fails only because domains are anti-bot heads | DISQUALIFIED (D1) | Drop, honest-no. |
| G3 fails but domains should be reachable | HOLD | Escalate the misses to founder, do not disqualify the prospect on a product bug. |

---

## 6. Stop conditions and edge cases

- Cannot produce 2 of 3 trusted reads on their real domains: no demo. Route
  per section 1.2. Do not book time to show a weak result.
- A live call misses on stage: classify it (section 1.3), name it honestly,
  move on. Do not spin a null as a hit.
- `resolve_product` returns a null envelope: Exa credits are out. Say so, fall
  back to a URL or GTIN read. It is a credit state, not a broken product.
- They push on webhooks, SDKs, Apple, mainnet x402, or auto-billed overage:
  state it as roadmap or best-effort, never as shipped. See `05` for the
  objection matrix.
- Prospect is majority anti-bot head but insists: still disqualify (D1).
  Re-targeting them wastes calibration on domains Legibility cannot legally serve,
  which is a kill signal in `00` section 2.
- Deal qualifies as a design partner: your next job is `06`, wiring
  `legibility_id` storage and `report_outcome`. That is the moat igniting and the
  single most important thing this pipeline exists to produce.

---
Last reviewed: 2026-07-06.
