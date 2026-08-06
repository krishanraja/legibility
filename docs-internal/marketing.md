# Marketing

## Positioning statement

For developers building agent buy-flows, Legibility is the product-data
primitive that turns a URL, GTIN, or product name into a typed product
object with a **calibrated** confidence per field, a price band, a stable
`legibility_id`, and the per-call cost in the response, and that an autonomous
agent can discover and pay for over MCP and x402, without a human signup.

## Messaging hierarchy

1. **Wedge (one line):** "Typed product object. Calibrated confidence per
   field. Cost in the response. Payable by an agent."
2. **Proof:** the **real captured hero call** (the storefront shows an
   actual API response, not a mock), the named-competitor matrix, the docs,
   and the golden-set precision figure (precision at the 0.7 gate = 1.0 on a
   held-out split). We only bill reads that clear the gate.
3. **Social:** waitlist count, agent ecosystem partners (when real),
   customer quotes (when real). Never fabricate.

Do not lead with "AI", "next-generation", or "intelligent". Do not claim
"any URL." The honest scope is structured retail (serving JSON-LD, Shopify,
verified OpenGraph) plus GTIN/barcodes **today**; bot-hostile retailers
(Apple, Nike, Lego) are a **premium/roadmap** story, not a launch claim.

## Channels (launch)

- **Hacker News:** Show HN with a real `curl` demo on a URL that returns a
  trusted object today (a Shopify store or a GTIN), not a bot-hard retailer.
- **X / dev Twitter:** focus on the agent + calibrated-confidence angle.
  The x402 piece is testnet, so pitch it as a preview, not a live rail.
- **MCP directories:** list the MCP server now (read + resolve are live at
  `/api/mcp`); note that x402 settlement is Base Sepolia testnet.
- **Base ecosystem:** the x402 wedge is novel here; lean in, but call it
  testnet until a live settlement lands.
- **Targeted DMs:** Diffbot / Firecrawl power users complaining about
  schema drift, uncalibrated confidence, or pricing.
- **Long-form:** one post per wedge. "Why we bill trusted reads, not
  calls." "Calibrated confidence is a feature, not a footnote." "Why a band
  beats a price."

## SEO

Primary keyword set:

- "product data API"
- "MCP product server"
- "x402 commerce API"
- "agent shopping API"
- "product confidence score"
- "schema.org product API"

Single H1 per page. Distinct meta description per route. Canonical and
og:url match the route, never the homepage.

## Launch checklist

- [ ] `legibility.io` DNS pointed at Vercel and resolving (propagating now;
      today the live surface is `legibility.io`). Never reference
      `legibility.sh`, which is dead.
- [ ] `APP_ORIGIN` flipped to `legibility.io` in `src/config/product.ts` once
      DNS resolves.
- [ ] Owner email + support@ alias.
- [ ] x402 wallet set in `X402_RECIPIENT`; note settlement is testnet until
      a live Base Sepolia payment lands.
- [ ] Stripe live; Free/Starter/Growth SKUs live; live checkout canary run
      once before pushing conversion.
- [ ] First waitlist approvals batched and emailed.
- [ ] Metrics dashboard live (`/dashboard/metrics`: North Star weekly, trust
      rate by method, golden-eval runs).
- [ ] Status page live.
- [ ] HN post drafted, demo recorded on a URL that wins today.

## Do-not-say list

- "AI-powered"
- "Real-time" (we have caches and price bands; say so)
- "Enterprise-grade" (until we have one)
- "Any URL" or "works on every store" (structured + barcodes today; hard
  retailers are roadmap)
- "Webhooks" (they do not exist yet)
- x402 "live" or "on mainnet" (it is Base Sepolia testnet, no live
  settlement yet)
- "The Stripe of product data" (or any "the X of Y")
- Em dashes (see design.md)

---
Last reviewed: 2026-07-06.
