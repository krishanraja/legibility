# Legibility GTM Playbook (start here)

> **SUPERSEDED IN PART. READ THIS BEFORE ACTING ON ANYTHING BELOW.**
>
> This playbook was written on 2026-07-06 for the previous positioning: a typed
> product-data API sold to developers building agent buy-flows. The shipped
> product now leads with a machine-readability index sold to commercial owners
> of a catalogue, and `src/routes/index.tsx` states in its own header that it is
> "written for a commercial buyer, not a developer".
>
> Two consequences, and the second one matters more than the first.
>
> **Audience and messaging below are stale.** Every ICP definition, sequence,
> hook and demo script targets the old buyer. Treat them as history, not as
> instructions. Rewriting them is a commercial judgement about who this is
> sold to, so it is deliberately not done here.
>
> **Three capability claims below were wrong and have been corrected in place,**
> because this directory says it is written to be executed by an agent without
> a human in the loop, and an agent acting on them would have made claims the
> product cannot support:
>
> - The Bright Data unblocker is **dormant and deliberately switched off**. It
>   was described as live with named retailers verified. The front page,
>   `public/llms.txt` and `docs-internal/product.md` all say a site being
>   unreadable without it _is the finding_, so pitching it inverts the
>   argument the product rests on.
> - There is **no Custom or Enterprise plan, no Slack channel and no SLA**.
>   `scripts/check-geo.ts` fails the build if those claims reappear in
>   `llms.txt`, because they were removed from there once already.
> - The cohort index is **built and has never been run**, so no cohort figure
>   exists. Do not cite one.
>
> The current, accurate statements of what exists are `public/llms.txt` and
> `public/llms-full.txt`, both of which are gated in CI. Where this directory
> disagrees with them, they win.

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

| Stage                | What happens                                                                                        | Read this                            |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------ |
| prospect             | find and score ICP-fit targets, apply the gates and disqualifiers, emit a ranked list               | `01-icp-and-targeting.md`            |
| personalize          | pick the wedge, the angle, and the proof read for this specific target                              | `02-positioning-and-messaging.md`    |
| outreach             | send copy-paste templates with merge fields, obey cadence and stop conditions                       | `03-outreach-sequences.md`           |
| demo                 | run the live-read demo script on their own catalog, never mock                                      | `04-demo-and-qualification.md`       |
| qualify              | run the gate and disqualifier checklist, produce a verdict                                          | `04-demo-and-qualification.md`       |
| design-partner offer | quote the tier or make the partner offer, handle objections, close                                  | `05-pricing-objections-and-close.md` |
| onboard              | wire `legibility_id` storage and `report_outcome`, verify in the database, set the feedback cadence | `06-design-partner-motion.md`        |
| measure              | read the North Star, keep the CRM current, run the weekly loop and the kill checks                  | `07-metrics-crm-and-loop.md`         |

---

## Which doc for which task

| If your task is...                                                            | Go to                                                           |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Understand the mission, the North Star, and what is true today                | `00-operating-brief.md` (read first, it is the source of truth) |
| Build a ranked target list from cold, or score one account                    | `01-icp-and-targeting.md`                                       |
| Pick the one-liner, the pitch, the wedge, or the right proof read             | `02-positioning-and-messaging.md`                               |
| Write and send a cold email, LinkedIn, or community message                   | `03-outreach-sequences.md`                                      |
| Run a live demo, ask discovery questions, or produce a qualification verdict  | `04-demo-and-qualification.md`                                  |
| Quote a price, answer an objection, or close a deal                           | `05-pricing-objections-and-close.md`                            |
| Make the design-partner offer, onboard a partner, or run the weekly loop      | `06-design-partner-motion.md`                                   |
| Track metrics, maintain the CRM, write the weekly rollup, or run a kill check | `07-metrics-crm-and-loop.md`                                    |
| Confirm a specific fact, number, price, or scope limit before you send        | `00-operating-brief.md`, CANONICAL FACTS block                  |

---

## Honest scope (never violate, pitch only this)

Works today, live-verified: Shopify storefronts, barcodes and GTINs,
cooperating JSON-LD and strong OpenGraph, and fuzzy-name resolve when Exa has
credits.

Corrected 2026-09-23: this list previously included "hard retailers via the
Bright Data Web Unlocker (Nike, Lego, MediaMarkt verified)". The unblocker is
built, cost-capped and switched off. A site that cannot be read without it
returns a graceful null at no charge, and that unreadability is the finding
rather than an obstacle to route around. Never pitch it as live.

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
