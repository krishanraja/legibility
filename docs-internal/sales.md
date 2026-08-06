# Sales

## What Legibility actually returns (say this straight)

A URL, GTIN, or fuzzy product name in; a **typed product object with a
calibrated confidence per field, a price band, the source method, an
opaque `legibility_id`, and the per-call cost** out. Confidence is a
calibrated probability, so the 0.7 gate means "about 70% likely correct."
Four tools ship today: `read_product`, `resolve_product` (synchronous,
takes `{name}`), `compare_products`, and `brief_product`. An MCP server is
live at `/api/mcp` (read + resolve), and x402 is live on Base Sepolia
(testnet).

**Coverage, honestly.** Trusted coverage today is **structured data**:
serving JSON-LD, Shopify storefronts, GTIN/barcodes, and verified
OpenGraph. That is a large slice of commerce and it returns real objects
right now. **Bot-hostile retailers (Apple, Nike, Lego) block the
datacenter IP and do not return a trusted read today.** A residential-proxy
fallback (Bright Data Web Unlocker) is built but dormant; hard-retailer
coverage is a premium and roadmap story, not a today claim. Do not sell
"any URL." Sell "structured retail and barcodes today, hard retailers next."

## ICP

1. **Agent buy-flow devs.** Building "buy this for me", procurement
   copilots, comparison agents. 1 to 20 engineers. Already paying for
   one or two of: Diffbot, Firecrawl, ScrapingBee, headless infra.
2. **Commerce infra teams.** Marketplaces, affiliate networks,
   comparison sites enriching their own catalogue.
3. **Autonomous agent platforms.** Stacks shipping MCP servers and
   looking for paid tools.

## Qualifying questions

- What's the trigger that makes you call us instead of a scraper?
- How do you handle confidence today? (If "we don't", that's our wedge.)
- Which stores matter most? (Sets whether structured coverage fits now or
  they need the hard-retailer roadmap.)
- Who pays: a human with a card, or an agent over x402?
- What's your tolerance for stale price? (Sets the cache TTL story.)
- Do you need MCP, REST, or both?

## Top objections

**"Diffbot already does this."**
Diffbot returns a typed object. It does not return a **calibrated**
confidence per field, does not stamp cost in the response, has no MCP
surface, and does not accept x402. An agent cannot discover Diffbot and
pay on its own.

**"We'll just use Firecrawl + GPT-4."**
You can. You then own: the schema, the cache, the calibration harness, the
price-band semantics, the barcode merge, the is-product check, the MCP
server, and the x402 settlement. We are that stack, finished, behind one
call, and we only bill you when the read clears the trust gate. The cost on
every response makes the build-vs-buy maths trivial.

**"Why should I trust a confidence number?"**
Because it is calibrated against a labelled golden set, not a coverage
proxy. 0.7 means roughly 70% likely correct, and you get it per field:
hard-gate at 0.9 on `gtin`, accept 0.6 on `category`. On a held-out test
split, precision at the gate was 1.0. Most vendors give you one number or
none.

**"Does it work on Apple / Nike?"**
Not today. Those retailers block datacenter traffic. We are honest about
that: structured-data stores and barcodes return trusted objects now, and
a residential-proxy fallback for the hard retailers is on the roadmap
(premium). If your target list is mostly hard retailers, we tell you before
you pay.

**"Base Sepolia / x402 sounds risky."**
It is testnet today, opt-in, and you can ignore it entirely and pay with a
card. No live settlement has happened yet; mainnet is later. The agent
surface is a bonus, not a dependency.

**"What about Bright Data / Apify?"**
Different shape. They sell access to crawlers; we sell typed answers.
Customers using them as data sources are a good fit. (We use a Bright Data
fallback ourselves for hard retailers.)

## Pricing tiers

- **Free:** **no card required**, 1,000 trusted reads/mo, **hard stop** at
  the cap (no overage, no surprise bill). We only count reads that returned
  a product at confidence >= 0.7, so nulls and low-confidence answers never
  burn quota.
- **Starter ($29/mo):** 5,000 trusted reads, $0.01/read overage.
- **Growth ($199/mo):** 50,000 trusted reads, $0.005/read overage, higher
  limits, Slack channel, SLA.
- **Custom:** quote on high volume or any on-prem extractor request.

Do **not** sell webhooks. They do not exist; webhook delivery is roadmap,
not a Starter feature.

## Demo script (5 min)

1. `curl read_product` on a **real Shopify product URL or a GTIN** (a store
   that returns today, e.g. an Allbirds product) -> typed object, calibrated
   confidence per field, price band, method, `legibility_id`, and cost. This is
   the same call the live hero shows.
2. Same call to the MCP server (`/api/mcp`) with no key -> **402** with
   payment instructions.
3. Pay over x402 (Base Sepolia testnet) -> same response. (Flag it as
   testnet; card is the default path.)
4. `resolve_product` with `{name: "Sony WH-1000XM5"}` -> resolves
   synchronously to a typed object (works when Exa has credits).
5. Show the dashboard: one trusted read, one cost line, the `legibility_id`,
   and that a null read cost nothing.
6. Show docs (`/docs/api/read-product` and `/docs/mcp`).

Never demo on `an-example-store.com` or a bot-hard retailer; use a URL that
returns a trusted object today.

---

Last reviewed: 2026-07-06.
