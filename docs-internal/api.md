# API (internal reference)

The contract and the trade-offs behind it. All four product tools plus the outcome-closure
channel are live in production. Confidence is now a calibrated probability (isotonic fit on a
held-out golden split), so the 0.7 gate means "about 70% likely to be correct," which is the unit
the North Star counts.

## Surfaces

- **REST** for developers: `POST /api/v1/<tool>`, auth via `Authorization: Bearer plk_...`.
- **MCP** for agents: `POST /api/mcp` (JSON-RPC 2.0). Discovery is free; `tools/call` is paid.

REST exposes `read_product`, `resolve_product`, `compare_products`, `brief_product`, and
`report_outcome`. MCP exposes `read_product` and `resolve_product`; `compare_products` and
`brief_product` are REST-only for now (they compose `read_product`, so MCP parity is a thin
follow-up when an agent needs them). `report_outcome` is REST-only and never billed.

Live host today is `https://legibility.io`. `legibility.io` is being pointed at Vercel and
is propagating; when it resolves, `APP_ORIGIN` in `src/config/product.ts` flips in one place. Do
not reference `legibility.sh`: it was never the API host.

## Tools

| Tool               | Status | Sync/async | Body                                                        |
| ------------------ | ------ | ---------- | ----------------------------------------------------------- |
| `read_product`     | live   | sync       | exactly one of `url`, `gtin`; optional `min_confidence`     |
| `resolve_product`  | live   | sync       | `name` (2+ chars); optional `min_confidence`                |
| `compare_products` | live   | sync       | `urls`: array of 2 to 5 product URLs                        |
| `brief_product`    | live   | sync       | exactly one of `url`, `gtin`, `name`; optional `min_confidence` |
| `report_outcome`   | live   | sync       | `outcome` + one of `request_id`, `legibility_id`; optional `observed_price`, `observed_currency`, `note` |

`resolve_product` is **synchronous**. It takes `{ name }`, runs neural retrieval (Exa) then
extraction of the top candidates within the request budget, and returns the resolved product in the
same response. There is no async job id, no `res_...` handle, and no `GET /v1/resolutions/{id}`
endpoint: that async design was considered and never built. (Name-resolve depends on Exa credits;
when Exa is out of credits the call returns a null envelope, not an error.)

### Response envelope (read_product / resolve_product / brief_product)

```json
{
  "request_id": "req_...",
  "input": { "url": "..." },
  "product": {
    "title": "...", "brand": "...", "gtin": "...",
    "price": { "low": 110, "high": 110, "currency": "USD", "as_of": "...", "n_sources": 2 },
    "availability": "in_stock", "attributes": {}
  },
  "legibility_id": "pl_...",
  "field_confidence": { "title": 0.95, "price": 0.8 },
  "confidence": 0.77,
  "method": "shopify",
  "calibration_version": "...",
  "sources": ["..."],
  "cost_usd": 0.012,
  "cached": false,
  "as_of": "..."
}
```

- `confidence` is a **calibrated probability**, not a coverage proxy. It is fit with isotonic
  regression (`worker/src/calibrate.ts` + `calibration.json`) and stamped with the
  `calibration_version` that produced it, so a stored confidence stays auditable across recalibrations.
- `field_confidence` carries per-field calibrated confidence and is returned on cache hits too (a
  cached read is not a thinner read).
- `legibility_id` is an opaque minted identity (`pl_...`) for a trusted product. It is stable across
  re-reads and is never derived from the URL or GTIN. Store it as your own foreign key; feed it back
  to `report_outcome`.
- `method` is the extraction path that produced the object: `jsonld`, `shopify`, `opengraph`,
  `gtin` (barcode), `name` (resolve), or `cache`. Trusted coverage is structured data (serving
  JSON-LD, Shopify, GTIN) plus verified OpenGraph. See Coverage below.
- On a miss the envelope is well-formed with `product: null` and a below-gate `confidence`. A miss
  is never charged and never consumes quota (see Billing). The extractor never throws: an upstream
  failure returns a null envelope, not a 500.

`compare_products` returns `{ input, items[], price_delta, cost_usd, cached }`. Each `items[]` entry
is `{ url, title, brand, price, availability, confidence, method }`; `price_delta` is
`{ min, max, spread, currency }` computed over the low ends, or `null` when no priced item resolved.
`brief_product` returns `{ input, product, confidence, method, brief, cost_usd, cached }` where
`brief` is a short string composed deterministically from the typed fields (no LLM, no invention).

### report_outcome

The outcome-closure channel: an agent reports whether a Legibility answer led to a real result. This is
the one label class a competitor cannot crawl, buy, or self-adjudicate, because it exists only
downstream of a real agent acting on a real Legibility answer.

```
POST /api/v1/report_outcome
Authorization: Bearer plk_...
{ "outcome": "purchased", "legibility_id": "pl_...", "observed_price": 109.99, "observed_currency": "USD", "note": "..." }
```

- `outcome` (required) is one of `purchased`, `price_matched`, `price_mismatch`, `out_of_stock`,
  `wrong_product`, `other`.
- Provide `request_id` or `legibility_id` (at least one) to link the outcome to the read. `observed_price`,
  `observed_currency`, and `note` (truncated to 500 chars) are optional.
- Success returns `202 { received: true }`. This call is not metered and not billed.

## Auth

Two independent paths. A `tools/call` (or any billed REST tool) needs one of them.

### API key (`plk_`)

- Keys are sha256-hashed at rest; the prefix and last four are stored for display. The full key is
  shown once at creation.
- One key per account in v1. Rotation is create-new then revoke-old from the dashboard.
- Keyed calls are rate-limited, quota-checked, and metered (see below).
- Admin server functions require `requireSupabaseAuth` AND `has_role(auth.uid(), 'admin')`.

### x402 (agent micropayment)

- MCP `initialize`, `tools/list`, `ping` are free. `tools/call` with no key returns **HTTP 402**
  with a body: `{ x402Version: 1, error, accepts: [PaymentRequirements] }`.
- `PaymentRequirements`: `scheme: "exact"`, `network: "base-sepolia"`, `maxAmountRequired` (atomic
  USDC, 6 decimals), `payTo` (`X402_RECIPIENT`), `asset` (Base Sepolia USDC
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e`), `maxTimeoutSeconds`, `extra: { name: "USDC", version: "2" }`.
- The agent signs an ERC-3009 `TransferWithAuthorization` (gasless for the buyer) and resends with a
  base64 `X-PAYMENT` header. Legibility verifies and settles via the facilitator
  (`X402_FACILITATOR`, default `https://x402.org/facilitator`), then returns `200` with an
  `X-PAYMENT-RESPONSE` header carrying the settlement.
- x402 calls are paid on-chain, so they skip account metering and rate limiting.
- **Network is Base Sepolia (testnet). There is no live settlement yet:** the on-chain path is
  wired and testable but not carrying real money, pending a funded recipient. We do not custody
  funds; payment goes straight to `X402_RECIPIENT`.

## Rate limits

- Per-plan, enforced by the `rate_check(_user_id)` Postgres function: a 60-second sliding window
  count over `usage_events`, budget = `plans.rate_per_sec * 60` per minute (default 60/min for an
  account with no active subscription).
- Every keyed response carries `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`.
  Over the limit returns `429` with `retry-after`.
- Fail-open: a rate-infra error never blocks a paying call.

## Billing and metering

The billing unit is the **trusted read**, not the call.

- A call is `billable` only when it returned a trusted product: `product` present AND
  `confidence >= 0.7`. The API route stamps this from the response envelope (`src/lib/api/meter.ts`).
- A null or low-confidence read charges nothing and does not consume monthly quota. You are never
  billed for a miss.
- Every keyed call still writes a `usage_events` row (tool, endpoint, status, `cost_usd`, latency,
  cached, plus `confidence`, `product_returned`, `billable`, `domain`, `envelope_hash`,
  `request_id`, `calibration_version`) and touches `api_keys.last_used_at`. Writes are awaited
  (serverless drops fire-and-forget work). The row is a calibration observation, not just a counter.
- **Monthly quota is enforced before the worker call** by `entitlement_check(_user_id)`. On a free
  account over its allowance it returns `402` with `{ error: "quota_exceeded", ... }`; a free cost
  fuse returns `402 { error: "cost_fuse", ... }`. Enforcing before the fetch means a free account
  cannot run unbounded real-cost extractions. The check fails safe: on an RPC error a free caller is
  blocked, a paid caller is allowed.

Plans (trusted reads per calendar month, UTC):

| Plan    | Price     | Included trusted reads | Overage                     | Card |
| ------- | --------- | ---------------------- | --------------------------- | ---- |
| Free    | $0        | 1,000                  | none (hard stop at the cap) | no   |
| Starter | $29/mo    | 5,000                  | $0.01 / trusted read        | yes  |
| Growth  | $199/mo   | 50,000                 | $0.005 / trusted read       | yes  |

Paid-tier overage is defined in `plans` but is **not yet auto-metered to Stripe**: the metered
reporter is founder-gated on a live billing canary. Until it ships, paid accounts are not hard
blocked at the cap (only free accounts are).

## Errors

JSON error bodies with a stable shape: `{ error, message }`. Codes in use:

| HTTP | `error`                          | When                                                        |
| ---- | -------------------------------- | ----------------------------------------------------------- |
| 400  | `invalid_json`                   | body is not valid JSON                                      |
| 401  | `unauthorized`                   | missing or invalid `plk_` key                               |
| 402  | `quota_exceeded` / `cost_fuse`   | free account over its monthly quota or the free cost fuse   |
| 402  | (x402 `PaymentRequirements`)     | MCP `tools/call` with no key and no settled payment         |
| 405  | `method_not_allowed`             | wrong HTTP method on a POST-only route (with `Allow` header) |
| 422  | `invalid_request`                | wrong arity or a malformed argument                         |
| 429  | `rate_limited`                   | over the per-plan rate window (with `retry-after`)          |
| 500  | `insert_failed`                  | `report_outcome` could not persist                          |
| 502  | `upstream_unavailable`           | the extraction worker did not respond                       |
| 503  | `external_worker_not_configured` | worker URL/token not set (should not happen in prod)        |

New codes are additive. In MCP, tool-level input errors are returned inside a JSON-RPC result with
`isError: true` rather than as an RPC error, so discovery-vs-call semantics stay clean.

## Coverage

Trusted coverage is A-reduced by design (`worker/docs/decisions/og-scope.md`): structured data
(serving JSON-LD, Shopify via `/meta.json` for currency, GTIN/barcode) plus verified OpenGraph. A
content-validity stage (`worker/src/isproduct.ts`, deterministic-first, with a Haiku verifier behind
`PLINTH_LLM_VERIFY`) rejects non-products (404s, homepages, block pages) before scoring. Bot-hostile
retailers (Apple, Nike, Lego) block the datacenter IP; a Bright Data Web Unlocker fallback exists
(`worker/src/unblock.ts`, fallback-only, pay-per-success, cost-capped) but is **dormant** pending a
Bright Data payment method and zone.

## Webhooks

Not built. There is no webhook delivery, no `resolution.done` event, and no signed callback. The
v1 tools are synchronous, so there is nothing to fan out. The `webhooks` and `webhook_deliveries`
tables exist but are reserved and unused; do not describe a webhook contract to customers until it
ships.

## Why these decisions

- **Calibrated confidence, gate at 0.7:** the score is now a probability of correctness measured on
  a held-out golden split, so "0.7" is a claim we can defend, and the trust rate the North Star
  tracks is computable from production data.
- **Trusted-read billing:** value is the trusted object, not the attempt. Charging for nulls would
  bill mostly for misses and punish the honest gate. Nulls are free.
- **Price as a band:** product-page prices are stale, regional, or promotional. A band with `as_of`
  and `n_sources` is the smallest honest answer.
- **No bulk endpoints in v1:** they hide cost from agents and reward scraping we do not want.
- **Free MCP discovery, paid call:** an agent must be able to see the tools before it decides to pay.

---
Last reviewed: 2026-07-06.
