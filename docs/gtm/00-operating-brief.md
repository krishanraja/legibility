# 00 Operating Brief (read this first)

This is the mission brief for the Legibility agent fleet. Every other GTM doc
ladders to this one. If a section writer or an outreach agent is ever unsure
what is true, the CANONICAL FACTS at the bottom of this file win. Do not
invent facts, numbers, customers, or proof that are not in this file or the
docs it points to.

Last reviewed: 2026-07-06.

---

## 1. The mission (2 sentences)

Land 2 to 3 procurement and buy-flow design partners who wire outcome
closure (they store the opaque `legibility_id` in their own schema and call
`POST /api/v1/report_outcome` when a Legibility answer leads to a real buy),
inside the 6 to 12 month window before a branded competitor bolts a typed
product MCP onto Firecrawl, Diffbot, or Zyte. That closed-outcome traffic
is the only asset that compounds and that no competitor can clone, buy, or
backdate, so landing it is the whole game and everything else the fleet
does is top of funnel that feeds it.

Why this and nothing else: as shipped, Legibility is a clean, honest API that a
funded team can rebuild in a quarter. The three assets that make it
un-cloneable (outcome-closed calibration, opaque identity history in a
customer's own database, a demand-weighted private eval corpus) are all
worth exactly zero at zero users. They start their clocks at the first
retained, outcome-reporting account and not one day earlier. See
`C:/Users/krish/.scratch/audit/legibility/2026-07-04/MOAT.md` for the full
defensibility thesis.

---

## 2. The single North Star and how the fleet knows it is winning

**North Star:** weekly trusted reads per active account. A trusted read is a
call that returned a product at confidence >= 0.7 (a calibrated 0.7 means
"about 70% likely correct"). Beta target: 7 or more trusted reads per active
account per week. It is instrumented live via the `northstar_weekly` RPC.

**Winning signals, in priority order.** The fleet is winning when these move,
in this order of importance:

1. **Outcome reports flowing.** At least one design partner calling
   `report_outcome` on a regular cadence. This is the moat igniting and it
   is the single most important signal the fleet exists to produce.
2. **`legibility_id` stored by partners.** A design partner has the opaque
   `legibility_id` as a foreign key in its own schema and depends on it. This is
   switching cost forming where no competitor can reach.
3. **first_trusted_read activation.** New accounts reach their first trusted
   read fast (sign-in to first >= 0.7 read, target under 3 minutes). The
   activation event is instrumented.
4. **Weekly trusted reads per active account** trending toward 7 or more.

**Losing and stop signals (from `repo/docs/KILL-CRITERIA.md`).** Any one of
these is a strategy meeting, not a footnote:

- Trust rate (share of calls at or above 0.7, via `trust_rate_by_method`)
  stuck under 0.60. The thesis fails regardless of GTM.
- Median under 3 trusted reads/week, repeat rate under 30%, after 8 weeks
  with 10 or more active accounts.
- Zero outcome reports for two consecutive months after the first design
  partner is live. The moat is running on manufacturable fuel only.
- Query mix over 50% on the anti-bot head (Amazon, Walmart, Target, Apple).
  The fleet is calibrating domains Legibility cannot legally serve. Re-target.

---

## 3. Positioning and pitch

**Canonical one-liner (reuse verbatim everywhere):**
> Legibility turns a product URL, barcode, or fuzzy name into a typed product
> object your agent can trust: calibrated per-field confidence, a price band,
> a stable id, and the per-call cost stamped in, over REST and MCP.

**3-sentence pitch:**
> If you build an agent that buys, compares, or looks up physical products,
> you hit the same wall: reading the product page reliably. Legibility is that
> layer, finished, behind one call over REST or MCP. You send a URL, a GTIN,
> or a fuzzy name and get back a typed object with a calibrated confidence
> per field, a price band, source method, a stable `legibility_id`, and the exact
> cost of the call, and you only pay when a read clears the 0.7 trust gate,
> so nulls and low-confidence answers are free.

Full messaging, wedges, and the objection matrix live in
`02-positioning-and-messaging.md`.

---

## 4. ICP and qualification

**The ICP in one paragraph.** Top of funnel: developers building agent
buy-flows (buy-this-for-me agents, procurement copilots, comparison agents),
teams of 1 to 20 engineers, already paying for Diffbot, Firecrawl,
ScrapingBee, or headless/Playwright infrastructure, who need a typed product
answer with a confidence they can gate on. The moat-critical subset, the one
the fleet is really hunting, is procurement and buy-flow design partners
operating on supplier and long-tail domains rather than the anti-bot consumer
head. That subset matters because it has the highest willingness to pay in
the research (roughly $200 to 2K per month; field-level confidence is table
stakes and an audit trail is a product requirement), and because its traffic
lands on domains Legibility can legally read, which is the only place
outcome-closure data can accumulate. Full targeting, sourcing, and scoring
are in `01-icp-and-targeting.md`.

**3 hard qualification gates (all three must be true to work a prospect):**

1. They are building an agent or automation that consumes product data
   programmatically and wants a typed schema, not a human browsing dashboard.
2. They already spend on extraction/scraping/headless (Diffbot, Firecrawl,
   ScrapingBee, Playwright, Browserless) or hand-roll JSON-LD parsing, so the
   pain is real and a budget line exists.
3. Their priority domains are majority reachable today: structured-data
   retailers (JSON-LD), Shopify storefronts, barcodes, cooperating
   catalogues, or supplier long-tail. Legibility returns trusted objects for
   their real targets now, not "someday."

**3 hard disqualifiers (any one kills the prospect):**

1. Their targets are majority Amazon, Walmart, Target, Apple, or other
   top-tier anti-bot heads. Legibility cannot serve those reliably. Do not
   pretend it can.
2. They are a price-tracker or time-series price-monitoring use case. Avoid:
   live-price-claim legal risk, willingness to pay too low ($0.001 to 0.005),
   and it is the exact segment Legibility refuses on principle.
3. They need live checkout/order placement, inventory or stock feeds, or a
   legal guarantee on price. Out of scope in v1. Do not sell it.

The full gate-and-disqualify checklist in executable form is in
`04-demo-and-qualification.md`.

---

## 5. Honest scope (never violate this)

Agents pitch only what is true today. State limits proactively when relevant.

**Works today (real objects, live-verified):**

- Shopify storefronts (product JSON, currency read so a price band forms).
- Barcodes / GTIN (Open Food Facts, UPC databases).
- Cooperating JSON-LD retailers and strong OpenGraph pages.
- Bot-hostile retailers via the Bright Data Web Unlocker fallback: Nike,
  Lego, and MediaMarkt are verified returning real objects.
- Fuzzy-name resolve (Exa) when Exa has credits.
- Live proof URLs to demo on: LEGO Millennium Falcon $849.99, Allbirds $110,
  Sony WH-1000XM5, Coca-Cola.

**Does not work / honest limits (say these when relevant, never hide them):**

- Apple and a few top-tier anti-bot sites are best-effort. They currently
  return a graceful null with no charge and no crash, not a trusted object.
- Price is a **band**, not a live-guaranteed spot price.
- Overage auto-billing to Stripe and outbound webhooks are roadmap, not
  shipped. Do not sell webhooks.
- x402 is testnet only (Base Sepolia). No live mainnet settlement has
  happened. Card is the default and only real payment path.
- SDKs are not shipped. `compare_products` and `brief_product` are REST-only
  (MCP currently exposes `read_product` and `resolve_product`).

Never sell "any URL." Sell "structured retail, barcodes, and cooperating
JSON-LD today, plus hard retailers via the unlocker (Nike/Lego/MediaMarkt
verified, Apple still blocked)."

---

## 6. Pricing and the design-partner offer

**Pricing (the trusted-read unit is the whole point: a null or below-0.7
read charges nothing and consumes no quota).**

| Tier | Price | Included trusted reads/mo | Overage | Notes |
|---|---|---|---|---|
| Free | $0, no card | 1,000 | none, hard stop at cap | key, REST + MCP, email support |
| Starter | $29/mo | 5,000 | $0.01/read | priority email |
| Growth | $199/mo | 50,000 | $0.005/read | higher limits, Slack, SLA |
| Custom | quote | 250,000+/mo | quote | on-prem extractor, residency |

Note for agents: overage rates are defined but automatic metering to Stripe
is founder-gated on a live canary, so do not promise auto-billed overage as
shipped. Hard-retailer reads (via the unlocker) cost Legibility about $0.005 to
0.006 each, so they may be priced as a premium or gated to paid tiers; the
cost is stamped in every response, so this stays transparent.

**The design-partner offer (the fleet's real close).**

What we give:
- Free or heavily discounted access with generous trusted-read headroom.
- Direct founder support and a private Slack channel.
- Priority engineering attention on the partner's target domains.
- Roadmap influence and hands-on help wiring outcome closure.

What we ask (the two non-negotiables plus two soft asks):
1. Store the opaque `legibility_id` as a foreign key in their own database.
2. Wire `POST /api/v1/report_outcome` so their agent reports whether a Legibility
   answer led to a real purchase at the stated price and availability.
3. Regular feedback on misses (a short recurring check-in).
4. A logo or reference later, once value is proven. Not required upfront.

The onboarding runbook is `06-design-partner-motion.md`.

---

## 7. Guardrails (hard rules for every agent, every message)

- **No em dashes, ever.** Use commas, periods, colons, or "to" for ranges.
  This is a hard founder rule. Sweep every draft before it ships.
- **No fabricated proof.** Every demo is a real live call on a URL or GTIN
  that returns today. Never show a mock object, never invent a customer, a
  metric, a logo, or a number.
- **Never promise the roadmap as shipped.** Not Apple coverage, not webhooks,
  not mainnet x402, not SDKs, not auto-billed overage. State them as roadmap
  or best-effort when asked, never as facts.
- **Always lead with a real read.** Before any claim in a demo or a reply,
  run `read_product` or `resolve_product` on one of the prospect's real
  target URLs (or a known-good proof URL) and show the returned object.
- **State honest limits proactively.** Price is a band not a live guarantee,
  x402 is testnet, hard retailers are best-effort with a graceful null. If a
  prospect's target list is mostly hard retailers, tell them before they pay.
- **Voice.** Direct, concrete, technically credible. No hype, no fluff.
  Respect the reader's time. The audience is technical founders and senior
  engineers building agents.

---

## 8. How the fleet operates (the pipeline and the file map)

The motion is one pipeline. Each stage is documented in a numbered sibling
file so an agent can act from it without a human.

`prospect -> personalize -> outreach -> demo -> qualify -> design-partner
offer -> onboard -> measure`

| Stage | What happens | Documented in |
|---|---|---|
| prospect | find and score ICP-fit targets; apply the gates and disqualifiers | `01-icp-and-targeting.md` |
| personalize | pick the wedge and the proof read for this specific target | `02-positioning-and-messaging.md` |
| outreach | send copy-paste templates with merge fields; obey cadence and stop conditions | `03-outreach-sequences.md` |
| demo | run the live-read demo script; never mock | `04-demo-and-qualification.md` |
| qualify | run the gate/disqualifier checklist and the qualifying questions | `04-demo-and-qualification.md` |
| design-partner offer | present pricing, handle objections, make the partner offer and close | `05-pricing-objections-and-close.md` |
| onboard | wire `legibility_id` storage and `report_outcome`; set the feedback cadence | `06-design-partner-motion.md` |
| measure | read the North Star, keep the CRM current, run the weekly loop and kill checks | `07-metrics-crm-and-loop.md` |

Surface facts for agents: live domain `https://legibility.io`, docs at `/docs`, MCP at
`/api/mcp`. Do not reference `onplinth.io`, `plinth-tan.vercel.app` or `plinth.sh`; they
are dead.

---

## CANONICAL FACTS (section writers reuse this verbatim)

- **One-liner:** Legibility turns a product URL, barcode, or fuzzy name into a
  typed product object your agent can trust: calibrated per-field confidence,
  a price band, a stable id, and the per-call cost stamped in, over REST and
  MCP.
- **Pitch (3 sentences):** If you build an agent that buys, compares, or
  looks up physical products, you hit the same wall: reading the product page
  reliably. Legibility is that layer, finished, behind one call over REST or MCP.
  You send a URL, a GTIN, or a fuzzy name and get back a typed object with a
  calibrated confidence per field, a price band, source method, a stable
  `legibility_id`, and the exact cost of the call, and you only pay when a read
  clears the 0.7 trust gate, so nulls and low-confidence answers are free.
- **North Star:** weekly trusted reads per active account (a trusted read is
  a call returning a product at confidence >= 0.7). Beta target 7+/week.
  Activation: sign-in to first trusted read under 3 minutes. Moat ignition:
  outcome_reports flowing from a design partner.
- **ICP:** developers building agent buy-flows (buy-this-for-me, procurement
  copilots, comparison agents), 1 to 20 engineers, already paying for
  Diffbot, Firecrawl, ScrapingBee, or headless/Playwright, needing a typed
  answer with confidence they can gate on. Moat-critical subset: procurement
  and buy-flow design partners on supplier and long-tail domains (highest
  WTP, audit trail required, legally readable traffic).
- **Qualification gates (all 3):** (1) building an agent/automation that
  consumes product data programmatically, not a human dashboard; (2) already
  spends on extraction/scraping/headless or hand-rolls JSON-LD; (3) priority
  domains are majority reachable today (JSON-LD, Shopify, barcodes,
  cooperating catalogues, supplier long-tail).
- **Disqualifiers (any 1 kills it):** (1) targets are majority
  Amazon/Walmart/Target/Apple or other top-tier anti-bot heads; (2)
  price-tracker or time-series price-monitoring use case; (3) needs live
  checkout/order placement, inventory/stock feeds, or a legal price guarantee.
- **Pricing:** Free $0 no card, 1,000 trusted reads/mo, hard stop.
  Starter $29/mo, 5,000, $0.01 overage. Growth $199/mo, 50,000, $0.005
  overage, higher limits + Slack + SLA. Custom quote at 250,000+/mo (on-prem
  extractor, residency). Trusted-read unit: null or below-0.7 reads are free
  and consume no quota. Overage auto-billing is roadmap, not shipped.
- **Design-partner offer:** we give free or discounted access with headroom,
  direct founder support and a private Slack channel, priority on their
  domains, and roadmap influence; we ask that they (1) store the opaque
  `legibility_id` as a foreign key in their own schema, (2) wire
  `POST /api/v1/report_outcome` on real buys, (3) give feedback on misses on
  a recurring cadence, and (4) provide a logo or reference later once value
  is proven.
- **Scope statement:** Works today (live-verified): Shopify, barcodes/GTIN,
  cooperating JSON-LD and strong OpenGraph, hard retailers via the Web
  Unlocker (Nike/Lego/MediaMarkt verified), fuzzy-name resolve when Exa has
  credits. Proof URLs: LEGO Millennium Falcon $849.99, Allbirds $110, Sony
  WH-1000XM5, Coca-Cola. Does not work / limits: Apple and a few top-tier
  anti-bot sites are best-effort (graceful null, no charge); price is a band,
  not a live guarantee; webhooks, mainnet x402, SDKs, and auto-billed overage
  are roadmap; x402 is Base Sepolia testnet; `compare_products` and
  `brief_product` are REST-only. Never sell "any URL." Surfaces:
  `https://legibility.io`, docs at `/docs`, MCP at `/api/mcp`; `onplinth.io`,
  `plinth-tan.vercel.app` and `plinth.sh` are dead.
