# Glossary

**Agent.** A program that reasons and acts without a human in the loop
for each step. Legibility treats agents as first-class callers: discoverable
via MCP, paying via x402.

**Band price.** Price returned as `{ low, high, currency, as_of, n_sources }`
instead of a single number. Legibility refuses to present a single scraped
price as truth. Shopify currency is read from `/meta.json` so a band forms
instead of dropping.

**Billable.** A call counts as billable, and draws down monthly quota, only
when it returned a product AND overall confidence >= 0.7 (a trusted read).
This is stored on `usage_events.billable`. A null or below-gate read charges
nothing and does not consume quota. Monthly quota is enforced by the
`entitlement_check` RPC (a 402 before the worker is ever called) plus a free
cost fuse.

**Cache (product_cache).** Server-side store of typed product objects,
keyed by normalised input. Entries with overall confidence < 0.7 are NOT
written. A cache hit returns real per-field confidence (the `field_confidence`
column), plus the stored `legibility_id` and `calibration_version`. TTL: 7 days
default, 1 hour for volatile fields.

**Calibration.** Confidence is passed through an isotonic calibration map
(`worker/src/calibrate.ts` + `calibration.json`) fitted on labelled outcomes,
so the number is a calibrated probability of correctness rather than a raw
score. That is why the 0.7 gate reads as "at least 70% likely correct." The
fitted version is stamped on every call as `calibration_version`.

**Confidence.** Overall score from 0 to 1, plus per-field scores. It is a
calibrated probability (see Calibration): 0.7 means roughly a 70% chance the
object is correct. A content-validity stage (`worker/src/isproduct.ts`,
deterministic-first with an optional Haiku verifier behind
`PLINTH_LLM_VERIFY`) rejects non-product pages before scoring, so a 404 or a
category page scores near zero instead of passing on field coverage.

**GTIN.** Global Trade Item Number. The 8/12/13/14-digit barcode.
Legibility's `read_product` accepts `gtin` instead of `url`.

**MCP.** Model Context Protocol. A discovery and call protocol for
LLM-driven agents. Legibility exposes `read_product` and `resolve_product`
over MCP at `/api/mcp`.

**legibility_id.** An opaque, stable identifier minted for each trusted product
(a product returned at confidence >= 0.7). The same input for the same
product returns the same `legibility_id` across reads. It is returned in the
response and stored on `product_cache`. It is Legibility's identity handle for a
product, independent of the source URL or GTIN, and the anchor for outcome
reporting.

**plk_ key.** Customer API key with `plk_` prefix. sha256-hashed at
rest, shown ONCE at creation.

**Resolve vs read.** `read_product` takes a precise reference (URL or
GTIN) and returns synchronously. `resolve_product` takes a fuzzy `{ name }`
and ALSO returns synchronously: it resolves the canonical product in the same
call. There is no async job, no `res_` id, and no `GET /v1/resolutions/{id}`.
That async model was never built. Name resolution uses Exa and works whenever
Exa has credits.

**Schema.org superset.** Our product object is a strict superset of
schema.org Product. We add `confidence`, `field_confidence`, `source`,
`cost_usd`, a `legibility_id`, and a band-shaped `price`.

**Stamped cost.** The `cost_usd` field returned in every response.
Lets an agent budget and decide whether to keep calling.

**Trusted read.** A call that returned a product object at overall confidence
>= 0.7. This is the unit that matters: the North Star counts trusted reads per
active account per week, billing charges only trusted reads (see Billable),
and the cache stores only trusted reads. A null or below-gate response is not
a trusted read: it is free and does not consume quota.

**Wedge.** One of the five differentiators in [README.md](./README.md).
If a piece of copy or a product decision does not ladder to a wedge,
ask why we're shipping it.

**x402.** Open HTTP 402 micropayment standard. Legibility accepts USDC on
Base. The live surface runs on Base Sepolia (testnet): the verify-and-settle
flow is proven there, but there is no live mainnet settlement yet. Mainnet is
roadmap.

---
Last reviewed: 2026-07-06.
