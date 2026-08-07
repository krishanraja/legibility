# 02 Positioning and Messaging

This is the phrasing library for the Legibility fleet. Every outreach agent,
demo agent, and reply agent pulls language from here so the whole fleet
speaks with one voice and never contradicts itself. If anything here ever
conflicts with `00-operating-brief.md`, the operating brief's CANONICAL
FACTS win. Do not invent numbers, customers, logos, or proof that are not
in this file or the brief.

Hard rules for every line you send:

- No em dashes, ever. Use commas, periods, colons, or "to" for ranges.
- No fabricated proof. Every demo is a real live call that returns today.
- Never promise the roadmap as shipped (webhooks, mainnet x402, SDKs,
  auto-billed overage, Apple coverage).
- Voice: direct, concrete, technically credible, no hype. The reader is a
  technical founder or a senior engineer building an agent. Respect their
  time.

Last reviewed: 2026-07-06.

---

## 0. Merge fields (fill every one before you send)

Templates in this file use `{{double_brace}}` fields. An outreach agent must
resolve all of them from the prospect record before sending. If a field
cannot be resolved, do not send; route back to `01-icp-and-targeting.md` to
finish enrichment.

| Field                  | Meaning                                     | Example                     |
| ---------------------- | ------------------------------------------- | --------------------------- |
| `{{first_name}}`       | prospect first name                         | Dana                        |
| `{{company}}`          | their company or project                    | Cartwheel                   |
| `{{their_product}}`    | the agent/product they are building         | a buy-this-for-me copilot   |
| `{{their_scraper}}`    | the extraction tool they already pay for    | Firecrawl                   |
| `{{their_target_url}}` | a real product URL from their target domain | a supplier catalogue page   |
| `{{proof_url}}`        | the live URL you demo on (from section 4)   | LEGO Millennium Falcon page |
| `{{proof_result}}`     | the real returned value (from section 4)    | a typed object at $849.99   |
| `{{signal}}`           | the trigger you detected (from section 5)   | "hiring an agent engineer"  |
| `{{sender_name}}`      | the human or agent identity sending         | Krish                       |
| `{{docs_link}}`        | https://legibility.io/docs                  | https://legibility.io/docs  |

---

## 1. The canonical one-liner and pitch (reuse verbatim)

**One-liner (use this exact sentence in bios, subject-adjacent lines, and
the first line of any deck):**

> Legibility turns a product URL, barcode, or fuzzy name into a typed product
> object your agent can trust: calibrated per-field confidence, a price
> band, a stable id, and the per-call cost stamped in, over REST and MCP.

**3-sentence pitch (use in outreach bodies and demo intros):**

> If you build an agent that buys, compares, or looks up physical products,
> you hit the same wall: reading the product page reliably. Legibility is that
> layer, finished, behind one call over REST or MCP. You send a URL, a GTIN,
> or a fuzzy name and get back a typed object with a calibrated confidence
> per field, a price band, source method, a stable legibility_id, and the exact
> cost of the call, and you only pay when a read clears the 0.7 trust gate,
> so nulls and low-confidence answers are free.

**One-breath version (for a reply, a Slack DM, a hallway line):**

> One call, product URL or barcode or fuzzy name in, a typed object with
> calibrated confidence and a price band out, and you only pay when it
> clears the trust gate.

**The single differentiator, if you get one sentence:** Legibility is the only
option that returns a calibrated confidence you can gate on (0.7 means about
70% likely correct, measured on a held-out set) and only bills when the read
clears that gate.

---

## 2. Value props mapped to each ICP segment's pain

Pick the segment first, then lead with that segment's top pain and the wedge
that answers it. Do not spray all five value props at once. One pain, one
wedge, one proof read.

### Segment A: Agent buy-flow developers (the volume ICP)

Who: teams of 1 to 20 engineers building buy-this-for-me agents, procurement
copilots, and comparison agents. Already paying for Diffbot, Firecrawl,
ScrapingBee, or running headless/Playwright.

| Their pain                                                                                    | The Legibility wedge                                                 | The line to use                                                                                                |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Reading the product page reliably is the wall every buy-flow hits                             | A finished typed-object layer behind one call                        | "The product-page read is the part you keep rebuilding. That is the whole of what we ship."                    |
| The scraper returns HTML or a blob; you still own schema, parsing, price semantics            | Typed object with a price band, source method, and a stable id, done | "You get a typed object, not a page. Title, brand, GTIN, a price band with as_of and n_sources."               |
| No signal to decide when to trust the answer, so agents hallucinate a model number or a price | Calibrated per-field confidence you can gate on                      | "Confidence is a calibrated probability. Hard-gate 0.9 on gtin, accept 0.6 on category. You decide per field." |
| Cost per call is invisible until the invoice                                                  | The exact cost_usd stamped in every response                         | "Every response carries cost_usd. Build-vs-buy math is in the payload, not in a spreadsheet."                  |
| You pay your scraper for every attempt, including the misses                                  | Trusted-read billing: nulls and sub-0.7 reads are free               | "You only pay when a read clears the 0.7 gate. Misses cost you nothing and burn no quota."                     |

### Segment B: Procurement and buy-flow design partners (the moat-critical subset)

Who: procurement copilots and buy-flow agents operating on supplier and
long-tail domains, not the anti-bot consumer head. Highest willingness to
pay in the research ($200 to 2K/mo), audit trail is a product requirement,
field-level confidence is table stakes. This is the segment the fleet is
really hunting. Lead these with the design-partner offer (see
`06-design-partner-motion.md`).

| Their pain                                                                  | The Legibility wedge                                                           | The line to use                                                                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Procurement needs an audit trail: which source, what confidence, as of when | Source method, calibration_version, and per-field confidence on every read     | "Every read is auditable: the method that produced it, the calibration version, per-field confidence, and n_sources on the price."                         |
| Supplier pages restructure and your URL-keyed history dies                  | An opaque, stable legibility_id you store as a foreign key                     | "You store an opaque legibility_id in your own schema. It survives site restructures. Your history does not reset when a URL changes."                     |
| No way to prove the agent's answer matched reality at the buy               | The outcome-closure channel: report_outcome on real buys                       | "Call report_outcome when a buy succeeds at the stated price. It is never billed, and it makes every future read on that domain more trustworthy for you." |
| Field-level confidence is a hard requirement, not a nicety                  | Calibrated per-field confidence, precision 1.0 at the gate on a held-out split | "Confidence is calibrated, not a coverage proxy. On the held-out golden split, precision at the gate was 1.0 (Wilson low 0.832)."                          |

### Segment C: Autonomous agent platforms and MCP-native stacks (secondary)

Who: stacks shipping MCP servers, looking for paid tools an agent can
discover and call without a human.

| Their pain                                                         | The Legibility wedge                                           | The line to use                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Every paid tool needs a human to sign up and hold a card           | MCP server with free discovery, plus x402 agent payment        | "Your agent discovers the tools for free over MCP, then pays per call over x402. No human in the loop." |
| Product-data tools return untyped text an agent cannot reason over | A typed object with a confidence field the agent can branch on | "The agent gets a typed object and a calibrated confidence it can gate on, not a wall of text."         |

Honest limit to state up front with Segment C: x402 is Base Sepolia testnet.
Card is the default and only live payment path. Say so before they build on
it.

### Segment D: Commerce infra teams (secondary)

Who: marketplaces, affiliate networks, and comparison sites enriching their
own catalogue.

| Their pain                                                          | The Legibility wedge                                          | The line to use                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Enriching a catalogue means owning extraction, dedupe, and identity | Typed object plus a stable legibility_id for dedupe and joins | "One call gives you a typed object and a stable id you can dedupe and join on."             |
| GTIN and URL both point at the same product but you cannot tie them | Barcode and URL both resolve; legibility_id is the join key   | "URL in or barcode in, same legibility_id out for the same product. That is your join key." |

---

## 3. Legibility vs the field

Use this to answer "how are you different from X." State it flat, no hype.
The honest read: any single row is copyable, and a funded team can rebuild
the shipped API in a quarter (we say this internally, never to a prospect).
What compounds is outcome-closure under stored legibility_ids, which is the last
two rows and is the only thing a competitor cannot backdate.

| Capability                            | Legibility                                       | Diffbot            | Firecrawl + your LLM                           | DIY (Playwright + hand-rolled)      |
| ------------------------------------- | ------------------------------------------------ | ------------------ | ---------------------------------------------- | ----------------------------------- |
| Typed product object                  | Yes, one call                                    | Yes (entity graph) | You build the schema                           | You build the schema                |
| Per-field calibrated confidence       | Yes, isotonic fit on a held-out set, gate at 0.7 | No                 | Self-reported, not calibrated                  | No                                  |
| Cost stamped per call (cost_usd)      | Yes, in every response                           | No                 | You compute it                                 | You compute it                      |
| Only bill on a trusted read           | Yes, nulls and sub-0.7 are free                  | No, per call       | No, per scrape                                 | N/A, your own infra cost either way |
| Price as a band (as_of, n_sources)    | Yes                                              | Spot value         | You build it                                   | You build it                        |
| MCP server (agent-discoverable)       | Yes, read + resolve at /api/mcp                  | No                 | Firecrawl MCP scrapes pages, not typed product | No                                  |
| x402 agent micropayment               | Yes, Base Sepolia testnet                        | No                 | No                                             | No                                  |
| Opaque stable legibility_id you store | Yes, survives URL restructure                    | Its own entity ids | No                                             | No                                  |
| Outcome-closure (report_outcome)      | Yes, never billed                                | No                 | No                                             | No                                  |

Notes an agent can quote:

- Diffbot owns a large product-identity graph and is a real answer for pure
  entity lookup. It does not calibrate confidence, does not stamp cost, has
  no MCP surface, and an agent cannot discover and pay for it on its own.
- Firecrawl plus your own LLM is a legitimate build. You then own the
  schema, the calibration harness, the price-band semantics, the barcode
  merge, the is-product check, the MCP server, and the settlement. Legibility is
  that stack finished, billed only on trusted reads.
- Bright Data and Apify sell access to crawlers, a different shape from a
  typed answer. Teams using them as a data source are a good fit; Legibility
  itself uses a Bright Data Web Unlocker as a fallback for hard retailers.

---

## 4. Proof points (real live reads, real numbers)

Always lead a demo or a skeptical reply with a real read. Never mock. These
four are the standing proof URLs and they return today. Pick the one that
matches the prospect's domain class.

| Proof                  | Input               | Method                         | What comes back                                                                                              | Use it when                                                              |
| ---------------------- | ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| LEGO Millennium Falcon | product URL         | hard retailer via Web Unlocker | typed object at $849.99, clears the gate                                                                     | prospect doubts hard-retailer coverage (Lego, Nike, MediaMarkt verified) |
| Allbirds               | Shopify product URL | jsonld                         | Men's Wool Runner at $110, confidence 1.0, field_confidence title 0.90 brand 0.98 price 0.98, cost_usd 0.003 | prospect runs on Shopify or structured retail                            |
| Sony WH-1000XM5        | fuzzy name          | resolve (Exa)                  | resolves synchronously to a typed object                                                                     | prospect needs name-to-product, not just URL-in                          |
| Coca-Cola              | GTIN / barcode      | gtin                           | typed object from barcode                                                                                    | prospect works from barcodes or catalogue GTINs                          |

Rules for using proof:

- The Allbirds envelope is the one with exact field numbers. Quote those
  numbers verbatim; do not invent confidence decimals for the other three.
  For Lego, Sony, and Coke, state the returned value and that it clears the
  0.7 gate, nothing more precise than you can show live.
- If the prospect gives you a real target URL, run it first and demo on
  their URL. Only fall back to these four if their target does not return
  today, and if it does not, tell them (see the honest scope line).
- Live proof beats every claim in this doc. Show the object, then talk.

---

## 5. Message angles by signal

Detect the signal, pick the matching angle, fill the merge fields, send.
Each angle has one wedge and one stop condition. If the stop condition
fires, do not send; the prospect is disqualified per `00-operating-brief.md`
section 4.

### Angle 1: They already pay for a scraper

Signal: job posts, docs, or their stack mention Firecrawl, ScrapingBee,
Diffbot, Browserless, or headless/Playwright for product data.

Wedge: finished stack, billed only on trusted reads.

> Subject: the product-page read, finished
>
> {{first_name}}, you are paying {{their_scraper}} for the product-page
> read on {{their_product}}. That is the exact layer we ship, one call over
> REST or MCP: a typed object with calibrated per-field confidence, a price
> band, a stable id, and the cost stamped in. The difference that matters
> for your bill: we only charge when a read clears the 0.7 trust gate, so
> misses cost nothing. Here is a live read on {{proof_url}}: {{proof_result}}.
> Worth a look? {{docs_link}}
>
> {{sender_name}}

Stop condition: their targets are majority Amazon, Walmart, Target, or
Apple. Do not send; Legibility cannot serve those reliably.

### Angle 2: They use Diffbot

Signal: Diffbot in their stack, docs, or billing.

Wedge: calibrated confidence, cost stamp, MCP, and agent-pays that Diffbot
does not have.

> {{first_name}}, Diffbot gives you a typed object, which is real. What it
> does not give you: a calibrated confidence you can gate on per field, the
> cost stamped in each response, an MCP surface your agent can discover, or
> a way for the agent to pay per call itself. Legibility does all four, and only
> bills on reads that clear the 0.7 gate. Live read on {{proof_url}}:
> {{proof_result}}.

Stop condition: they only need bulk entity lookup on the anti-bot head and
have no confidence-gating need. Diffbot is genuinely the better fit; move on.

### Angle 3: They ship an MCP server or an agent platform

Signal: they publish an MCP server, list on an MCP registry, or their
product is an autonomous agent stack.

Wedge: an agent-discoverable, agent-payable typed product tool.

> {{first_name}}, {{their_product}} can call Legibility as an MCP tool: your
> agent discovers read_product and resolve_product for free, then pays per
> call over x402, no human signup. It gets a typed object with a calibrated
> confidence it can branch on. MCP is live at /api/mcp. One honest note:
> x402 is Base Sepolia testnet today, and card is the live path, so the
> agent-pays piece is a preview, not production settlement.

Stop condition: none specific, but never let the x402 line read as live
mainnet. If they want production on-chain settlement now, say it is roadmap.

### Angle 4: They build procurement or buy-flow on supplier or long-tail domains

Signal: procurement copilot, B2B buy-flow, supplier catalogues, or long-tail
domains rather than the consumer head. This is the moat-critical signal.

Wedge: audit trail, stable identity, and outcome-closure. Lead toward the
design-partner offer.

> {{first_name}}, for a procurement flow the read has to be auditable: which
> source, what confidence, as of when. Legibility returns exactly that, plus an
> opaque legibility_id you store in your own schema so your product history
> survives supplier site restructures. And you can call report_outcome when
> a buy succeeds at the stated price, which is never billed and makes every
> future read on that domain more trustworthy for you. This is the kind of
> use case we take on as a design partner. Live read on {{their_target_url}}
> or {{proof_url}}: {{proof_result}}.

Stop condition: they need a legal price guarantee, live checkout/order
placement, or live inventory feeds. Out of scope in v1. Do not sell it.

### Angle 5: They hand-roll JSON-LD parsing

Signal: their code or blog mentions parsing schema.org Product, JSON-LD,
OpenGraph, or "we extract the product from the page ourselves."

Wedge: you are already halfway, we finished and calibrated it.

> {{first_name}}, you are already pulling JSON-LD Product off the page for
> {{their_product}}. We ship that finished and calibrated: the same
> structured read, plus a Shopify and barcode path, plus a confidence that
> is an actual probability of correctness, not a coverage proxy, so you can
> gate at 0.7. One call, cost stamped in. Live read on {{proof_url}}:
> {{proof_result}}.

Stop condition: their priority domains are majority hard anti-bot heads that
never serve JSON-LD. Reachability gate fails; do not send.

### Angle 6: They complain about product-data trust or hallucination

Signal: a post, issue, or comment about the agent inventing a price, a model
number, or a wrong product; or "we cannot trust the extractor."

Wedge: calibrated per-field confidence to gate on.

> {{first_name}}, the fix for a hallucinated product field is a confidence
> you can actually gate on. Legibility returns a calibrated per-field confidence,
> 0.7 means about 70% likely correct, measured on a held-out golden set
> where precision at the gate was 1.0. Gate hard on the fields that matter,
> drop the rest. You only pay when a read clears the gate. Live read on
> {{proof_url}}: {{proof_result}}.

Stop condition: none, but only claim precision 1.0 with the Wilson-low
caveat (0.832) if pressed; never round it to "always right."

### Angle 7: They need multi-product comparison

Signal: a comparison agent, a "which is cheaper" flow, or a shopping
assistant that ranks products.

Wedge: compare_products in one call.

> {{first_name}}, for {{their_product}} you can pass 2 to 5 product URLs to
> compare_products and get back each item typed, with a price_delta computed
> across them, in one call. Same calibrated confidence and cost stamp per
> item. One note: compare_products is REST-only today, not on MCP yet.

Stop condition: they compare on the anti-bot head (Amazon vs Walmart). The
reachability gate fails; do not send.

---

## 6. The honest scope line (say this, do not soften it)

Paste this when a prospect asks "does it work on everything," or proactively
whenever their target list might include hard heads. Honesty here is the
brand.

> Straight answer on coverage. Works today, live-verified: Shopify
> storefronts, barcodes and GTINs, cooperating JSON-LD and strong OpenGraph
> retailers, and bot-hostile retailers through our Web Unlocker fallback,
> with Nike, Lego, and MediaMarkt verified returning real objects. Limits we
> state up front: Apple and a few top-tier anti-bot sites are best-effort and
> currently return a graceful null with no charge, not a trusted object;
> price is a band, not a live-guaranteed spot price; webhooks, mainnet x402,
> SDKs, and auto-billed overage are roadmap; x402 is Base Sepolia testnet;
> and compare_products and brief_product are REST-only for now. If your
> target list is mostly hard heads, we tell you before you pay.

Short version for a reply:

> Structured retail, barcodes, and cooperating JSON-LD today, plus hard
> retailers via the unlocker (Nike, Lego, MediaMarkt verified). Apple is
> still best-effort. We never sell "any URL."

---

## 7. Never say (hard stop list)

Do not use any of these. Each one is a false or unshipped claim.

- "Works on any URL" or "any store." Never. Say the scope line instead.
- "Live guaranteed price." It is a band with as_of and n_sources.
- "We support Apple." Apple is best-effort, currently a graceful null.
- "We have webhooks / SDKs / auto-billed overage." Roadmap, not shipped.
- "Pay on-chain / mainnet x402 in production." Testnet only (Base Sepolia).
- "compare_products / brief_product over MCP." REST-only today.
- Any customer name, logo, revenue number, or metric not in the brief.
- Any confidence decimal you cannot show live (the Allbirds numbers are the
  only field-level numbers you may quote verbatim).
- Em dashes. Sweep every draft.

---

## 8. Decision rule (which angle, in one pass)

An agent runs this top to bottom and stops at the first match:

1. Targets majority Amazon/Walmart/Target/Apple, or price-tracker use case,
   or needs checkout/inventory/price-guarantee? -> DISQUALIFY, do not send
   (brief section 4).
2. Procurement or buy-flow on supplier/long-tail domains? -> Angle 4, route
   to the design-partner motion.
3. Ships an MCP server or is an agent platform? -> Angle 3.
4. Complains about product-data trust or hallucination? -> Angle 6.
5. Needs multi-product comparison? -> Angle 7.
6. Uses Diffbot? -> Angle 2.
7. Pays for another scraper (Firecrawl, ScrapingBee, Browserless, headless)?
   -> Angle 1.
8. Hand-rolls JSON-LD? -> Angle 5.
9. None of the above but passes all three qualification gates? -> lead with
   the 3-sentence pitch (section 1) and a proof read (section 4).

Before any send, confirm: all merge fields resolved, a real proof read
attached, no never-say phrase present, no em dash. If any check fails, do
not send.
