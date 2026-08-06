# 01 ICP and Targeting

Who to target, how an agent finds them, and how an agent ranks them. This file
is executable: run the sources, apply the rubric, emit a ranked target list.
If any fact here conflicts with `00-operating-brief.md`, the operating brief
wins. Do not invent customers, logos, or numbers.

Last reviewed: 2026-07-06.

Ladders to: `00-operating-brief.md`. Feeds: `02-positioning-and-messaging.md`
(pick the wedge per target) and `03-outreach-sequences.md` (send).

---

## 0. What this file produces (the agent's job)

Input: nothing. You start cold.

Output: a ranked list of target accounts, each a JSON record matching the
schema in section 8, sorted by `fit_score` descending, with every
disqualified account dropped (not scored low, dropped). An agent should be
able to run sections 5 through 8 end to end and hand the top of the list
straight to `02-positioning-and-messaging.md` with no human in the loop.

The loop each account runs through:

```
find (section 5)  ->  gate (section 3)  ->  disqualify (section 4)
   ->  score 0 to 5 (section 6)  ->  emit record (section 8)  ->  rank
```

Stop conditions for a run are in section 9. Read them before you start so you
know when to stop pulling sources.

---

## 1. The primary ICP (hunt this first)

**Agent buy-flow developers.** Teams building agents that buy, compare, or
look up physical products: "buy this for me" agents, procurement copilots,
shopping and comparison agents, reorder and replenishment bots. 1 to 20
engineers. They already pay for Diffbot, Firecrawl, ScrapingBee, or run their
own headless/Playwright/Browserless infra, and they need a typed product
answer with a confidence they can gate on in code.

Why they buy: they hit the same wall Legibility removes, reading the product page
reliably and knowing when to trust the read. They have a budget line for
extraction already, so the spend is a swap, not a new category.

**The moat-critical subset (the real prize, weight it up).** Procurement and
buy-flow teams operating on **supplier and long-tail domains** rather than the
Amazon/Walmart/Apple anti-bot head. This subset is the point of the whole GTM
because:

- highest willingness to pay in the research (roughly $200 to $2K/month;
  per-field confidence is table stakes and an audit trail is a hard
  requirement, not a nice-to-have),
- their traffic lands on domains Legibility can legally and reliably read today
  (JSON-LD, Shopify, catalogues, supplier sites), and
- that is the only place `report_outcome` data can accumulate, which is the
  only asset that compounds. See `MOAT.md`.

When two accounts tie on `fit_score`, the one closer to this subset wins.

---

## 2. The secondary ICP (work only when primary is thin)

Two adjacent segments. Score them with the same rubric, but do not spend a run
on them while primary targets are still un-worked.

**S1. Commerce-infra catalog enrichment.** Marketplaces, affiliate networks,
price-comparison sites, and PIM/catalog teams enriching their own product
catalogue programmatically. They already run extraction at volume. Good fit
when the catalogue is supplier or long-tail, weak fit when it is Amazon-head
resale or pure price-tracking (see disqualifiers).

**S2. Agent-platform teams shipping MCP tools.** Teams building agent
frameworks, agent app stores, or vertical agent products who ship or curate
MCP servers and want a paid, credible product-data tool their users can call.
They are a distribution wedge (Legibility is an MCP tool they can list) more than a
direct high-volume buyer. Fit rises sharply if they also build a buy-flow
themselves (then they are primary).

---

## 3. The three qualification gates (all three must be true)

Reuse verbatim from the operating brief. An account passes only if all three
are true. If you cannot verify a gate, mark it `unknown` and treat it as not
yet passed (it caps the score, see section 6).

| #   | Gate                                                                                                                              | How an agent verifies it                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Building an agent or automation that consumes product data programmatically, wants a typed schema, not a human browsing dashboard | Repo, docs, landing page, or job post describes an agent/API/automation over product data, not a dashboard/BI tool                                                                |
| G2  | Already spends on extraction/scraping/headless or hand-rolls JSON-LD                                                              | Dependency on Diffbot/Firecrawl/ScrapingBee/Zyte/Apify/Bright Data/Browserless/Playwright/Puppeteer/Selenium in code, docs, or job posts; or a "we parse product pages" statement |
| G3  | Priority domains are majority reachable today                                                                                     | Their named target stores/domains are majority structured-data (JSON-LD), Shopify, barcodes/GTIN, cooperating catalogues, or supplier long-tail, not the anti-bot head            |

Passing all three does not make an account a good target. It makes it eligible
to be scored. The disqualifiers in section 4 can still drop it.

---

## 4. Hard disqualifiers (any one drops the account)

If any of these is true, set `fit_score = 0`, set `status = "DROP"`, record the
reason, and stop scoring. Do not soften, do not "keep for later." Dropping bad
targets is how the fleet protects the North Star and the trust rate.

| #   | Disqualifier                                                                           | Signal an agent detects                                                                      | Why it is fatal                                                                                            |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | Targets are majority Amazon, Walmart, Target, Apple, or other top-tier anti-bot heads  | Their example URLs, docs, or product all point at the anti-bot head                          | Legibility returns a graceful null there, not a trusted object. We would be selling a wall.                |
| D2  | Price-tracker or time-series price-monitoring product                                  | "track price over time", "price history", "price drop alerts", "camelcamelcamel-style"       | Lowest WTP ($0.001 to 0.005), live-price legal risk, and the exact segment Legibility refuses on principle |
| D3  | Needs live checkout/order placement, inventory/stock feeds, or a legal price guarantee | "places the order", "real-time inventory", "guaranteed in-stock/price"                       | Out of v1 scope. Selling it is a promise we cannot keep.                                                   |
| D4  | x402-first tinkerer with no real buy-flow                                              | Toy repo whose whole point is "pay an API with crypto", no product use case, no revenue path | Research explicitly warns off this segment; it never becomes a retained, outcome-reporting account         |
| D5  | No real buy-flow or product-data need at all                                           | Generic LLM wrapper, chatbot, or infra with no physical-product surface                      | Not the ICP. Zero pull.                                                                                    |

Note on D1: "majority" is the test. An account whose targets are 30% Amazon
and 70% Shopify/supplier passes the gate; flag the Amazon share in
`notes` so outreach sets expectations, but do not drop.

---

## 5. Sources to build the list (run these, in order)

Each source below yields candidate accounts. For each candidate, capture the
fields the section 8 schema needs. Prioritise sources top to bottom; they are
ordered by hit-rate for the primary ICP.

### 5.1 MCP registries (highest hit-rate: these teams ship agent tools)

| Registry | Where                  | What to pull                                                                                              | Query terms                                                                        |
| -------- | ---------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Smithery | `smithery.ai`          | Servers/tools in commerce, shopping, product, e-commerce, scraping categories; the org/author behind each | `shopping`, `product`, `ecommerce`, `commerce`, `scrape`, `catalog`, `procurement` |
| Glama    | `glama.ai/mcp/servers` | Same categories; note authors publishing multiple tools (they build agents)                               | same as above                                                                      |
| mcp.so   | `mcp.so`               | Listed servers + the "agents" and "shopping" tags                                                         | same as above                                                                      |

Decision rule: an author who publishes a shopping/commerce MCP server AND has a
product/company (not just a personal demo) is a strong primary candidate.

### 5.2 GitHub (find who builds buy-flows and who already pays for extraction)

Run these as GitHub search queries. Code search surfaces G2 (existing
extraction spend) directly.

Topics and repo search:

```
topic:mcp-server topic:shopping
topic:ai-agents ecommerce
topic:agentic commerce
"buy this for me" agent
"procurement" agent in:name,description,readme
"shopping agent" in:name,description,readme
```

Code search for extraction spend (G2 evidence, very high signal):

```
"firecrawl" "product"        (in code / requirements / package.json)
"diffbot"                      (api key usage, client imports)
"scrapingbee"
"api.diffbot.com"
"browserless" "product"
"playwright" "product page"   (hand-rolled extraction, our wedge)
```

Decision rule: a repo that imports Firecrawl/Diffbot/ScrapingBee AND parses
product/price fields is a gate-G1+G2 pass on sight. Capture the owning org.

### 5.3 Company and community sources

| Source                         | Where                                                                                    | What to pull                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Y Combinator company directory | `ycombinator.com/companies` filtered to AI + e-commerce/agents                           | Recent-batch companies building shopping/procurement agents                 |
| Product Hunt                   | `producthunt.com` search: shopping agent, buy-for-me, procurement copilot                | Launched products in the space + maker's company                            |
| Hacker News                    | "Show HN" for shopping/procurement/comparison agents                                     | Builder + repo + whether they mention their scraping stack                  |
| Agent-framework communities    | LangChain, LlamaIndex, CrewAI, Vercel AI SDK, AutoGen Discords/forums/GitHub discussions | People asking "how do I reliably read a product page/price?" (pain = wedge) |

### 5.4 Job boards (catalog-enrichment and extraction hiring = live budget)

Search job boards (Greenhouse, Lever, LinkedIn Jobs, Wellfound/AngelList,
YC Work at a Startup) for these phrases in JD text:

```
"catalog enrichment" OR "product data" OR "product catalog"
"web scraping" AND ("product" OR "ecommerce" OR "pricing")
"Firecrawl" OR "Diffbot" OR "ScrapingBee" OR "Bright Data"
"agentic" AND ("commerce" OR "checkout" OR "procurement")
```

A company hiring for product-data extraction has a budget line and a pain, both
today. The hiring company, not the role, is the account.

### 5.5 LinkedIn (titles that own the buy-flow or the catalog)

Titles to search, scoped to companies already surfaced above or to the segment:

```
"Founding Engineer" agent / commerce
"AI Engineer" shopping / procurement / commerce
"Head of Catalog" / "Catalog Data" / "Product Data"
"Founder" "buy for me" / "procurement copilot" / "shopping agent"
```

LinkedIn is for finding the person to reach once the account is scored, not for
scoring the account. Capture the person into `contact` in the record.

---

## 6. The scoring rubric (0 to 5, apply per account)

Score only accounts that passed all three gates (section 3) and hit zero
disqualifiers (section 4). Everything else is already `DROP`.

Compute `fit_score` from signal points, then band into 0 to 5. Sum the points
an account earns, apply the caps, then map the total to a band.

### 6.1 Signal points (additive)

| Signal                                                                                                | Points        | Detected from                                                      |
| ----------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| Ships a buy-flow / procurement / comparison agent as a product (primary ICP)                          | +3            | Landing page, repo, MCP server, launch post                        |
| Moat-critical subset: procurement or buy-flow on supplier/long-tail domains                           | +3            | Their target domains are supplier/catalogue, audit trail mentioned |
| Verified existing extraction spend (Diffbot/Firecrawl/ScrapingBee/Zyte/Apify/Bright Data/Browserless) | +2            | Code import, docs, job post                                        |
| Hand-rolls JSON-LD/Playwright product parsing (build-vs-buy wedge open)                               | +2            | Code, "we parse product pages ourselves"                           |
| Explicit "product data / reliable read / confidence" pain in an issue, forum post, or JD              | +2            | GitHub issue, Discord, HN, JD                                      |
| Ships or curates MCP tools (distribution + agent-native)                                              | +1            | Registry listing, repo                                             |
| 1 to 20 engineers (right-sized, fast to close)                                                        | +1            | Team page, LinkedIn headcount                                      |
| Reachable contact identified (founder/founding eng/catalog lead)                                      | +1            | LinkedIn, GitHub profile, site                                     |
| Secondary ICP only (commerce-infra enrichment or agent-platform, no own buy-flow)                     | -1            | Segment classification                                             |
| Any gate marked `unknown` (unverified)                                                                | cap at band 3 | Missing evidence                                                   |

### 6.2 Band mapping (points to 0 to 5)

| Points                 | fit_score | Tier | Meaning and action                                                     |
| ---------------------- | --------- | ---- | ---------------------------------------------------------------------- |
| 9+                     | 5         | A    | Moat-critical fit. Work now, personalize hard, aim for design partner. |
| 7 to 8                 | 4         | A    | Strong primary fit. Work now.                                          |
| 5 to 6                 | 3         | B    | Solid primary or strong secondary. Work after tier A.                  |
| 3 to 4                 | 2         | B    | Marginal. Queue; work only if a run is thin.                           |
| 1 to 2                 | 1         | C    | Weak. Park. Revisit if segment shifts.                                 |
| 0, or any disqualifier | 0         | DROP | Do not contact. Record reason.                                         |

Caps and tie-breaks:

- Any hit in section 4 forces `fit_score = 0` regardless of points.
- Any gate `unknown` caps `fit_score` at 3 until the gate is verified. Prefer
  spending a verification step over guessing.
- On a tie, the account closer to the moat-critical subset (section 1) ranks
  higher. Reflect this in ordering, not in the score.

---

## 7. Copy-paste research templates

### 7.1 Source-run kickoff (fill the merge fields, then run section 5)

```
RUN: build ranked Legibility target list
DATE: {{run_date}}
SOURCES THIS RUN: {{sources}}         # e.g. Smithery, GitHub code search, YC
TARGET COUNT: {{n_accounts}}          # stop when reached (see section 9)
SEGMENT FOCUS: primary                # only widen to secondary if primary thin
DISQUALIFIERS ACTIVE: D1 D2 D3 D4 D5
OUTPUT: ranked JSON records (schema section 8), fit_score desc, DROPs excluded
```

### 7.2 Per-account scoring worksheet (fill before emitting a record)

```
ACCOUNT: {{company}}
URL: {{homepage}}
WHAT THEY BUILD: {{one_line}}
GATES:  G1={{true/false/unknown}}  G2={{...}}  G3={{...}}
DISQUALIFIERS HIT: {{none | D1..D5 + evidence}}
SIGNALS (+/-):
  buy-flow product ........ {{+3/0}}
  moat-critical subset .... {{+3/0}}
  extraction spend ........ {{+2/0}}   evidence: {{firecrawl/diffbot/...}}
  hand-rolled parsing ..... {{+2/0}}
  product-data pain ....... {{+2/0}}   evidence: {{link}}
  ships MCP tools ......... {{+1/0}}
  1-20 eng ................ {{+1/0}}
  contact found ........... {{+1/0}}
  secondary-only .......... {{-1/0}}
POINTS: {{sum}}   ->   FIT_SCORE: {{0..5}}   TIER: {{A/B/C/DROP}}
PROOF URL TO DEMO ON: {{a reachable target domain of theirs, or a known-good proof URL}}
WEDGE HOOK FOR OUTREACH: {{the one true thing that makes this land, for 02}}
```

The `PROOF URL TO DEMO ON` must be a domain Legibility returns a trusted object for
today (their supplier/Shopify/GTIN target, or a known-good proof URL: LEGO
Millennium Falcon $849.99, Allbirds $110, Sony WH-1000XM5, Coca-Cola). If their
only targets are the anti-bot head, that is a D1 signal, recheck section 4.

---

## 8. Output record schema (emit one per surviving account)

```json
{
  "company": "{{company}}",
  "homepage": "{{url}}",
  "segment": "primary | secondary_s1 | secondary_s2",
  "what_they_build": "{{one line, concrete}}",
  "team_size_est": "{{1-20 | 20+ | unknown}}",
  "gates": { "g1": true, "g2": true, "g3": true },
  "disqualifiers_hit": [],
  "extraction_stack": ["{{firecrawl|diffbot|scrapingbee|playwright|...}}"],
  "target_domains": ["{{supplier/shopify/gtin domains they read}}"],
  "moat_critical": true,
  "signals_points": 9,
  "fit_score": 5,
  "tier": "A",
  "status": "WORK | QUEUE | DROP",
  "drop_reason": null,
  "proof_url_to_demo": "{{a reachable target of theirs or a proof URL}}",
  "wedge_hook": "{{the true, specific reason this lands}}",
  "contact": {
    "name": "{{name}}",
    "title": "{{founder/founding eng/catalog lead}}",
    "channel": "{{email|linkedin|github|x}}",
    "handle": "{{...}}"
  },
  "source": "{{smithery|github|yc|jobboard|hn|linkedin}}",
  "found_date": "{{run_date}}"
}
```

Rank the emitted array by `fit_score` descending, then by `moat_critical`
(true first), then by whether a `contact` was found. Hand tier A and B records
to `02-positioning-and-messaging.md`. Never hand a `DROP` downstream.

---

## 9. Stop conditions (when to end a run)

Stop the run and return the ranked list when any of these is true:

- **Target count reached.** You have `{{n_accounts}}` records at tier B or
  above. Ship the list.
- **Source exhausted.** You have worked every source in section 5 for the
  active segment focus and new pulls are returning duplicates of accounts
  already scored.
- **Duplicate saturation.** The last 20 candidates were all already in the
  list. Stop pulling that source.
- **Segment drift.** Primary-ICP hits have dried up and you are only finding
  secondary or disqualified accounts. Stop, ship what you have, flag to widen
  scope in the next run rather than lowering the bar this run.

Never do to hit a count:

- Do not contact a `DROP`. Ever.
- Do not downgrade a disqualifier to keep an account.
- Do not fill the list with x402-first tinkerers (D4) or price-trackers (D2).
  An empty slot is better than a bad target; bad targets calibrate domains
  Legibility cannot serve and drag the trust rate.

---

## 10. Worked example (what a good tier A record looks like)

Illustrative shape only, not a real customer. Do not treat as a reference or a
logo.

```
Company: (a procurement-copilot startup, 6 eng)
Builds: an agent that reorders MRO and lab supplies from distributor sites
Gates: G1 true (agent, typed data), G2 true (imports Firecrawl in repo),
       G3 true (targets are Grainger-style distributor + Shopify suppliers)
Disqualifiers: none
Signals: buy-flow product +3, moat-critical supplier domains +3,
         Firecrawl spend +2, product-data pain in a GitHub issue +2,
         6 eng +1, founding eng contact found +1  = 12 points
fit_score: 5, tier A, status WORK, moat_critical true
proof_url_to_demo: one of their supplier Shopify product URLs (returns today)
wedge_hook: "you already pay Firecrawl and still hand-gate confidence;
             Legibility returns a calibrated per-field confidence you can gate on,
             and only bills reads over 0.7"
```

That account goes to the top of the list and straight into
`02-positioning-and-messaging.md`.

---

## 11. Guardrails carried from the operating brief

- No em dashes, ever. Commas, periods, colons, or "to" for ranges.
- No fabricated targets, contacts, or evidence. If a gate is unverified, mark
  it `unknown` and cap the score; do not guess it true.
- Never score an anti-bot-head-only or price-tracker account above 0. They are
  disqualifiers, not low-fit targets.
- The `proof_url_to_demo` must be a domain Legibility actually returns a trusted
  object for today. If you cannot name one, the account is not ready to work.
- Voice for any `wedge_hook` or note: direct, concrete, technically credible,
  no hype. Audience is technical founders and senior engineers.

Surfaces: `https://legibility.io`, docs `/docs`, MCP `/api/mcp`. `onplinth.io`,
`plinth-tan.vercel.app` and `plinth.sh` are dead.
