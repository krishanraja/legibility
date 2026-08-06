# Legibility GTM Playbook (start here)

This directory is the operating manual for the Legibility agent fleet. It is
written to be executed by an agent, not skimmed by a human: every file has
explicit criteria, decision rules, copy-paste templates with merge fields,
disqualifiers, and stop conditions. An agent should be able to act from a
file without a human in the loop.

Read this page, then read `00-operating-brief.md`. After that, jump to the
numbered file for the stage you are working. If any file ever disagrees with
the CANONICAL FACTS block at the bottom of `00-operating-brief.md`, the brief
wins.

Last reviewed: 2026-07-06.

---

## The one rule (everything else ladders to this)

**Land 2 to 3 procurement and buy-flow design partners who wire outcome
closure:** they store the opaque `legibility_id` as a foreign key in their own
database and call `POST /api/v1/report_outcome` when a Legibility answer leads to
a real buy.

That closed-outcome traffic is the only asset that compounds and the only one
no competitor can clone, buy, or backdate. Landing it, inside the 6 to 12
month window before a branded competitor bolts a typed product MCP onto
Firecrawl, Diffbot, or Zyte, is the whole game. Everything else the fleet does
is top of funnel that feeds it. The full defensibility thesis is in
`C:/Users/krish/.scratch/audit/legibility/2026-07-04/MOAT.md`.

**North Star:** weekly trusted reads per active account (a trusted read is a
call that returned a product at confidence >= 0.7). Beta target: 7 or more per
active account per week.

**The single most important signal the fleet exists to produce:** outcome
reports flowing from a design partner. Until the first `report_outcome` fires,
the moat is a plan, not an asset. Close toward that event, not toward a yes.

---

## The end-to-end flow

One pipeline. Each stage is one numbered file. An account moves forward only
when the stage exit criterion is met.

```
prospect  ->  personalize  ->  outreach  ->  demo  ->  qualify
   ->  design-partner offer  ->  onboard  ->  measure
```

| Stage | What happens | Read this |
|---|---|---|
| prospect | find and score ICP-fit targets, apply the gates and disqualifiers, emit a ranked list | `01-icp-and-targeting.md` |
| personalize | pick the wedge, the angle, and the proof read for this specific target | `02-positioning-and-messaging.md` |
| outreach | send copy-paste templates with merge fields, obey cadence and stop conditions | `03-outreach-sequences.md` |
| demo | run the live-read demo script on their own catalog, never mock | `04-demo-and-qualification.md` |
| qualify | run the gate and disqualifier checklist, produce a verdict | `04-demo-and-qualification.md` |
| design-partner offer | quote the tier or make the partner offer, handle objections, close | `05-pricing-objections-and-close.md` |
| onboard | wire `legibility_id` storage and `report_outcome`, verify in the database, set the feedback cadence | `06-design-partner-motion.md` |
| measure | read the North Star, keep the CRM current, run the weekly loop and the kill checks | `07-metrics-crm-and-loop.md` |

---

## Which doc for which task

| If your task is... | Go to |
|---|---|
| Understand the mission, the North Star, and what is true today | `00-operating-brief.md` (read first, it is the source of truth) |
| Build a ranked target list from cold, or score one account | `01-icp-and-targeting.md` |
| Pick the one-liner, the pitch, the wedge, or the right proof read | `02-positioning-and-messaging.md` |
| Write and send a cold email, LinkedIn, or community message | `03-outreach-sequences.md` |
| Run a live demo, ask discovery questions, or produce a qualification verdict | `04-demo-and-qualification.md` |
| Quote a price, answer an objection, or close a deal | `05-pricing-objections-and-close.md` |
| Make the design-partner offer, onboard a partner, or run the weekly loop | `06-design-partner-motion.md` |
| Track metrics, maintain the CRM, write the weekly rollup, or run a kill check | `07-metrics-crm-and-loop.md` |
| Confirm a specific fact, number, price, or scope limit before you send | `00-operating-brief.md`, CANONICAL FACTS block |

---

## Honest scope (never violate, pitch only this)

Works today, live-verified: Shopify storefronts, barcodes and GTINs,
cooperating JSON-LD and strong OpenGraph, hard retailers via the Bright Data
Web Unlocker (Nike, Lego, MediaMarkt verified), and fuzzy-name resolve when
Exa has credits. Standing proof URLs: LEGO Millennium Falcon $849.99, Allbirds
$110, Sony WH-1000XM5, Coca-Cola.

Does not work or is roadmap, say so when relevant: Apple and a few top-tier
anti-bot sites are best-effort (they return a graceful null at no charge, not
a trusted object). Price is a band, not a live guarantee. Webhooks, SDKs,
mainnet x402, and auto-billed overage are roadmap. x402 is Base Sepolia
testnet. `compare_products` and `brief_product` are REST-only (MCP exposes
`read_product` and `resolve_product`).

Never sell "any URL." The full scope statement and the exact wording to use
are in `00-operating-brief.md` section 5 and `02-positioning-and-messaging.md`
section 6.

---

## Guardrails (every agent, every message)

- **No em dashes, ever.** Use commas, periods, colons, or "to" for ranges.
  Sweep every draft before it sends.
- **No fabricated proof.** Every demo is a real live call that returns today.
  Never a mock object, an invented customer, logo, metric, or number.
- **Always lead with a real read.** Run `read_product` or `resolve_product` on
  the prospect's own target (or a known-good proof URL) before any claim.
- **Never promise the roadmap as shipped.** Not Apple, webhooks, SDKs, mainnet
  x402, or auto-billed overage.
- **Voice.** Direct, concrete, technically credible. No hype, no fluff. The
  reader is a technical founder or a senior engineer building an agent.

Surfaces: live domain `https://legibility.io`, docs at `/docs`, MCP at `/api/mcp`. Do not
reference `onplinth.io`, `plinth-tan.vercel.app` or `plinth.sh`; they are dead.
