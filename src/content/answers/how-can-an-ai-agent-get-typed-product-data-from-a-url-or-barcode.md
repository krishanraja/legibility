---
title: "How can an AI agent get typed product data from a URL or a barcode?"
description: "One read_product call turns a product URL or a GTIN into a typed object with a price band, calibrated confidence and the cost of the call."
published: "2026-10-21"
updated: "2026-10-21"
tags: [product data, read_product, GTIN, API]
related:
  [
    what-does-a-calibrated-confidence-score-mean-for-an-agent,
    why-cant-an-ai-agent-read-a-product-page,
    how-do-i-connect-an-ai-agent-to-a-remote-mcp-server,
  ]
---

Call `read_product` with exactly one of a product `url` or a `gtin` barcode. Legibility returns a typed product object with a price band, per-field confidence, an overall calibrated confidence, the extraction method and the cost of the call. It is available over REST at `/api/v1/read_product` and as an MCP tool.

An agent that has to decide what to buy needs facts it can act on, not a page of HTML and a guess. A typed object with a confidence attached lets the agent check one number before acting, instead of trusting whatever a scraper happened to pull out.

## A request that works today

The GTIN below is a real barcode that returns a trusted object:

```bash
curl -X POST https://legibility.io/api/v1/read_product \
  -H "authorization: Bearer lgk_your_key" \
  -H "content-type: application/json" \
  -d '{"gtin":"8076800195057"}'
```

A product URL works the same way with `{"url":"https://..."}`. Sending both, or neither, is rejected as an invalid request.

## What comes back

```json
{
  "request_id": "req_...",
  "input": { "gtin": "8076800195057" },
  "product": {
    "title": "...",
    "brand": "...",
    "gtin": "...",
    "price": { "low": 110, "high": 110, "currency": "USD", "as_of": "...", "n_sources": 2 },
    "availability": "in_stock",
    "attributes": {}
  },
  "legibility_id": "pl_...",
  "field_confidence": { "title": 0.95, "price": 0.8 },
  "confidence": 0.77,
  "method": "gtin",
  "calibration_version": "...",
  "sources": ["..."],
  "cost_usd": 0.012,
  "cached": false,
  "as_of": "..."
}
```

- `confidence` is a calibrated probability, and 0.7 is the trust gate. See [what a calibrated confidence means](/answers/what-does-a-calibrated-confidence-score-mean-for-an-agent).
- `price` is a band with an `as_of` time and a source count, not a guaranteed live price.
- `method` names the path that produced the object: `jsonld`, `shopify`, `opengraph`, `gtin`, `name` or `cache`.
- `legibility_id` is a stable opaque id for a trusted product, safe to store as a foreign key.
- `cost_usd` is the cost of this call, stamped in the response.

## What it can read today

Trusted coverage is structured, verifiable data: pages that serve JSON-LD `schema.org/Product` to a plain request, Shopify storefronts, barcode lookups, and OpenGraph product pages admitted through a verified prior. Retailers that block datacenter requests do not return a trusted object today. When a page cannot be read, the envelope is still well formed, with `product: null` and a confidence below the gate, and [the reason pages](/why) explain each failure.

## Billing for a keyed call

With an API key the billing unit is the trusted read: a call is billable only when it returns a product at confidence 0.7 or higher. A null or below-gate read is not billed and does not count against quota. The free plan includes 1,000 trusted reads a month with a hard stop. Over MCP an agent can also pay per call in USDC, as described in [how an agent pays per call](/answers/how-can-an-ai-agent-pay-per-api-call-in-usdc).

## The related tools

- `resolve_product` takes a fuzzy `name` and returns the same envelope in the same call. There is no job id to poll.
- `compare_products` takes two to five URLs and returns a side-by-side matrix with the price delta. REST only.
- `brief_product` returns the typed object plus a short summary composed from its fields. REST only.

Request and response details are in the [read_product reference](/docs/api/read-product) and the [quickstart](/docs/quickstart).

## FAQ

### What happens if the page cannot be read?

The response has `product: null` and a confidence below 0.7. On an API key that read is free and does not use quota.

### Is the price a live price?

No. It is a band with `low`, `high`, `currency`, `as_of` and `n_sources`, because product-page prices are often stale, regional or promotional.

### Can I send a URL and a GTIN together?

No. `read_product` takes exactly one of them, and a request with both or neither is rejected before any work is done.
