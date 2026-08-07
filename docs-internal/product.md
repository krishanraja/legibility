# Product

## Vision

Legibility is the product-data primitive for the agent era. When an agent has
decided to buy, find, compare, or summarise a physical good, it should be
able to ask one API a typed question and get a typed answer, with a
calibrated confidence it can reason about and a cost it can pay for itself.

## The five wedges

See [README.md](./README.md). These are the non-negotiables. Every PR,
every section of copy, every demo, every objection handler should ladder
to at least one of them.

## Target users

- **Devs building agent buy-flows.** Comparison sites, affiliate stacks,
  procurement agents, in-house "buy this for me" copilots. They have a
  schema in mind and want one vendor, not three.
- **Autonomous agents.** Discover via the MCP directory, call
  `read_product`, settle in USDC over x402. No human in the loop.
- **Commerce infra teams.** Marketplaces and CRMs enriching their own
  catalogue.

## Jobs to be done

1. "Turn this URL into a product object I can trust."
2. "Find this barcode."
3. "Find the canonical product behind this fuzzy string."
4. "Tell my agent what a thing costs, with enough signal to decide."
5. "Let my agent pay for this itself."

## Non-goals (v1)

- Live order placement, checkout, or fulfilment.
- Stock or inventory feeds.
- Reviews aggregation as a primary product.
- Image generation, copy rewriting, marketing assets.
- A scraper-as-a-service for non-product pages.

## Scope: what Legibility trusts today (A-reduced)

Trusted coverage is the set of inputs the engine can return a calibrated,
gate-clearing object for. As shipped, that is structured data plus verified
OpenGraph:

- JSON-LD `Product` that actually serves (many retailers).
- Shopify storefronts (product JSON, with currency read from `/meta.json`
  so a price band forms).
- GTIN / barcode lookups.
- OpenGraph pages, when the signal is strong enough to verify.

Bot-hostile retailers (Apple, Nike, Lego and similar) block the datacenter
IP outright, so their pages are out of trusted scope from the current egress.
A Bright Data Web Unlocker fallback exists in the worker
(`worker/src/unblock.ts`): it is fallback-only, pay-per-success, and
cost-capped, but it is DORMANT. It needs a Bright Data payment method and a
zone before it turns on. Fuzzy-name resolve (Exa) works whenever Exa has
credits. The full scope decision is `worker/docs/decisions/og-scope.md`.

## Magic moments

Three moments the product is built to produce. All three are reachable today
on trusted scope.

1. **First trusted object.** A first call on a real URL, a Shopify product,
   or a GTIN returns a typed object at honest, calibrated confidence, in one
   call. Verified live (Allbirds at $110, GTIN lookups).
2. **Instant repeat read from cache.** The same input read again returns from
   `product_cache` at a tenth of the cost, with real per-field confidence on
   the hit. The cache now stores and returns `field_confidence`, alongside the
   stable `legibility_id` and `calibration_version`.
3. **The agent pays for itself.** An agent hits a 402, settles over x402, and
   gets the answer with no human signup. Proven on Base Sepolia (testnet). A
   recorded live mainnet settlement is roadmap, not shipped.

## Roadmap

**Shipped and live:** marketing site with an honest hero (the console shows a
real captured call, not a mock), dashboard (keys, usage, billing, overview),
auth, single secret API key (`lgk_`), all four tools over REST (`read_product`,
`resolve_product`, `compare_products`, `brief_product`), `read_product` and
`resolve_product` over MCP at `/api/mcp`, the extraction worker with a
content-validity stage, calibrated confidence, and price bands, per-plan
quota enforcement, trusted-read metering, Stripe billing (checkout + portal +
webhook, verified to live Stripe), x402 verify-and-settle on Base Sepolia
(testnet), the full data model with RLS, `/api/health`, CI, and interim legal
pages.

`resolve_product` is **synchronous**: it takes `{ name }` and returns the
resolved object in the same call. There is no async job id and no
`GET /v1/resolutions/{id}`. That endpoint never existed.

**Instrumentation and moat (live):** an opaque `legibility_id` is minted per
trusted product and is stable across reads (returned in the response and
stored on `product_cache`); every call is stamped with
`confidence` / `method` / `domain` / `envelope_hash` / `calibration_version`;
an `outcome_reports` table plus `POST /api/v1/report_outcome` lets an agent
report when a Legibility answer led to a real buy; `golden_eval_runs` records
precision at the gate; the `northstar_weekly` and `trust_rate_by_method`
RPCs and an admin `/dashboard/metrics` page read the North Star; `ops_daily`
monitoring plus a kill-floor alert at a 0.60 trust rate run on `pg_cron`.

**Roadmap, not built (do not sell as shipped):** outbound webhooks (there are
no async events in the sync-tool v1, so webhooks do not exist), automatic
metered overage billed to Stripe (founder-gated on a live canary), mainnet
x402, SDKs (TS first, then Python), `compare_products` / `brief_product` over
MCP, the Bright Data unblock fallback (dormant pending a payment method and
zone), and regional caches.

**Founder-gated before paid GA:** counsel review of the interim legal, the
paid-GA flip, a live Stripe canary to prove the subscription-activation
webhook and metered overage end to end, an Exa credit top-up for name-resolve,
the Base Sepolia faucet for a recorded live x402 settlement, and the
`legibility.io` DNS cutover.

## Success metrics

The North Star and stop conditions are the decision record in
[../docs/KILL-CRITERIA.md](../docs/KILL-CRITERIA.md). In short:

- **North Star:** weekly trusted reads per active account. A trusted read is a
  call that returned a product at confidence >= 0.7. Because confidence is now
  a calibrated probability (see the glossary), the 0.7 gate means "at least
  70% likely correct." The metric is instrumented (`northstar_weekly`) and
  reachable: it has been produced live on structured-data inputs.
- **Activation:** time from sign-in to first trusted read on `read_product`.
  Target under 3 minutes.
- **Retention:** week-over-week repeat rate.
- **Monetization:** free-to-paid conversion at the trusted-read cap; agent
  share of revenue via x402 (at mainnet). The billing unit is the trusted
  read: a null or below-gate response charges nothing and consumes no quota.
  Free tier is 1000 trusted reads/mo with a hard stop (no overage, no card).
  Starter is $29 for 5000 ($0.01 overage), Growth is $199 for 50000 ($0.005
  overage). Overage rates are defined for the paid plans, but automatic
  metering of overage to Stripe is not yet wired: it is founder-gated on the
  live canary.
- **Quality:** trust rate (share at or above 0.7, via `trust_rate_by_method`),
  cache hit rate, takedowns per week. On the held-out golden test split the
  engine measured precision 1.0 at the gate (Wilson low 0.832), adversarial
  rejection 1.0, GTIN recall 1.0, and zero crashes.

## Domain

The live surface today is https://legibility.io. DNS is delegated to Vercel and SSL is
issued. Do not reference `onplinth.io`, `plinth-tan.vercel.app` or `plinth.sh`. They are dead.

---

Last reviewed: 2026-07-06.
