# Legibility

Typed product data for software agents. One call turns a product URL, a GTIN barcode, or a fuzzy
product name into a typed product object with per-field confidence, a price expressed as a band,
the source method, and the per-call cost stamped in the response. It is exposed over both REST and
MCP, and payable either with an API key or per call in USDC over x402.

**Status: live.** App at https://legibility.io (the custom domain `legibility.io` is being
pointed at Vercel; DNS is propagating, so `legibility.io` is the live surface today). All
four tools, key auth, trusted-read metering, per-plan quota, the dashboard, Stripe billing, and the
MCP server are deployed. x402 runs on Base Sepolia (testnet; no live on-chain settlement yet).
Private beta. The old `legibility.sh` host does not exist: use the URLs above.

## Why Legibility (the five wedges)

1. **MCP-native, with x402 micropayments.** The same tools an agent can discover over MCP, payable
   in USDC on Base (Sepolia testnet in beta) per call, with no human signup.
2. **Cost stamped in every response** (`cost_usd`). No opaque credit bundles.
3. **Calibrated confidence with a 0.7 trust gate.** Confidence is an isotonic-calibrated
   probability, so `0.7` reads as "about 70 percent likely correct." Only results at or above the
   gate are treated as trusted, cached, and billed.
4. **Price as a band, not a number:** `{ low, high, currency, as_of, n_sources }`.
5. **One typed schema across URL, GTIN, and fuzzy name.**

## Honest scope (what returns a trusted object today)

Legibility's trusted coverage is **structured and verified data**, not "any URL":

- **JSON-LD** `schema.org/Product` that actually serves to a browser request.
- **Shopify** storefronts (currency resolved via `/meta.json`, so the price band forms).
- **GTIN / barcode** lookups (identity object; price where a source carries it).
- **OpenGraph** product pages, admitted through a verified prior.

Everything else is scored honestly and usually returns `product: null` at low confidence rather than
a guess. In particular, **bot-hostile retailers (Apple, Nike, Lego and similar) block the datacenter
IP** and do not return a trusted object today. A Bright Data Web Unlocker fallback exists in the
worker (fallback-only, pay-per-success, cost-capped) but is **dormant** pending a Bright Data payment
method and zone. Fuzzy-name resolve (Exa) works when the Exa account has credits. This scope
reduction is recorded in `worker/docs/decisions/og-scope.md`.

A `null` or below-gate read is not a failure of billing: it costs the caller nothing and does not
consume quota (see Billing).

## Quickstart

1. Sign in at https://legibility.io and create an API key (`lgk_...`) in the dashboard. The
   full key is shown once.
2. Call `read_product`. A GTIN always returns a trusted identity object:

   ```bash
   curl -X POST https://legibility.io/api/v1/read_product \
     -H "authorization: Bearer lgk_your_key" \
     -H "content-type: application/json" \
     -d '{"gtin":"8076800195057"}'
   ```

   A structured-data or Shopify URL works the same way:

   ```bash
   curl -X POST https://legibility.io/api/v1/read_product \
     -H "authorization: Bearer lgk_your_key" \
     -H "content-type: application/json" \
     -d '{"url":"https://www.allbirds.com/products/mens-wool-runners-natural-grey"}'
   ```

3. You get back a typed product, `field_confidence`, an overall `confidence` (the calibrated
   probability), a `legibility_id` (a stable opaque id for that trusted product), a price band, the
   `method`, the `calibration_version`, and `cost_usd`.

## Tools

| Tool               | Input                       | Returns                                                          |
| ------------------ | --------------------------- | --------------------------------------------------------------- |
| `read_product`     | `url` XOR `gtin`            | typed product, per-field + overall confidence, price band, cost |
| `resolve_product`  | `name`                      | best-match product via neural search (Exa) then extraction, in one synchronous call |
| `compare_products` | `urls` (2 to 5)             | side-by-side matrix plus the price delta                        |
| `brief_product`    | `url` XOR `gtin` XOR `name` | typed product plus a short agent-readable brief                 |

REST: `POST /api/v1/<tool>`. MCP: `POST /api/mcp` exposes `read_product` and `resolve_product`.

`resolve_product` is **synchronous**: pass `{ "name": "Sony WH-1000XM5" }` and it returns the
resolved product in the same response. There is no async job id and no `GET /v1/resolutions/{id}`
step (an earlier draft of the docs described one; it was never built).

## Auth

- **API key:** `Authorization: Bearer lgk_...`. Create and revoke in the dashboard. Keys are
  sha256-hashed at rest and shown once.
- **x402 (agents, no key):** MCP discovery is free. `tools/call` returns HTTP 402 with payment
  requirements; the agent pays in USDC on **Base Sepolia** (testnet), resends with an `X-PAYMENT`
  header, and the facilitator verifies and settles. The full flow is wired; live on-chain settlement
  is pending a funded buyer wallet (a Base Sepolia faucet drip). See
  [docs-internal/api.md](./docs-internal/api.md).

## Billing

The billing unit is a **trusted read**: a call is billable only when it returns a product **and**
`confidence >= 0.7`. A `null` or below-gate read charges nothing and does not consume quota.

| Plan    | Price     | Trusted reads / mo | Overage        | Card |
| ------- | --------- | ------------------ | -------------- | ---- |
| Free    | $0        | 1,000              | none, hard stop | not required |
| Starter | $29 / mo  | 5,000              | $0.01 / read   | required |
| Growth  | $199 / mo | 50,000             | $0.005 / read  | required |

Quota is enforced by the `entitlement_check` RPC, which returns `402` **before** the worker call is
made (a free-tier cost fuse backs this up), so the free tier is a genuine hard stop, not an invoice
surprise. Paid-plan **metered overage is not yet reported to Stripe** (roadmap; founder-gated on a
live canary), and **webhooks do not exist** (roadmap only). Subscribe and manage from the dashboard
at `/dashboard/billing`.

## Trust, calibration, and instrumentation

- **Content validity.** The worker separates real products from 404s, block pages, and homepage
  redirects with a deterministic-first content check, backed by an optional Haiku verifier behind the
  `PLINTH_LLM_VERIFY` flag (`worker/src/isproduct.ts`).
- **Calibrated confidence.** Confidence is passed through an isotonic calibration
  (`worker/src/calibrate.ts` + `calibration.json`) fit on a held-out golden split, so the number is a
  probability, not a coverage proxy. On that split: precision at the gate 1.0 (Wilson lower bound
  0.832), adversarial rejection 1.0, GTIN recall 1.0, zero crashes.
- **Stable identity.** Every trusted product mints an opaque `legibility_id` that is stable across reads
  and returned in the response and stored in `product_cache`.
- **Every call is an observation.** Each call is stamped with its confidence, method, domain,
  envelope hash, and `calibration_version`.
- **Outcome closure.** Agents can report whether a Legibility answer led to a real buy via
  `POST /api/v1/report_outcome` (rows land in `outcome_reports`).
- **North Star + metrics.** `northstar_weekly` and `trust_rate_by_method` RPCs, an admin
  `/dashboard/metrics` page, and a daily `ops_daily` rollup with a kill-floor alert are all live.
  See [`docs/KILL-CRITERIA.md`](./docs/KILL-CRITERIA.md).

## Architecture (short version)

- **This repo:** the TanStack Start app (marketing site, dashboard, REST `/api/v1/*`, MCP
  `/api/mcp`, Stripe billing). Deployed on Vercel (Node / Fluid Compute functions).
- **Extraction worker:** a separate deploy (`krishanraja/legibility-worker`) that does the real
  extraction (JSON-LD, OpenGraph, Shopify, barcode) with a browser User-Agent, runs the
  content-validity check, and scores calibrated confidence. `extractProduct` never throws: a hard
  domain returns a null envelope, not an error. The app proxies tool calls to it.
- **Data:** Supabase (project `cgkcplcamsijghalintq`): keys, usage, plans, subscriptions, cache
  (`product_cache` carries `field_confidence`, `calibration_version`, and `legibility_id`), plus the
  instrumentation tables (`outcome_reports`, `golden_eval_runs`) and the metrics RPCs.
- **Health:** `GET /api/health`.

Full detail is in [`docs-internal/`](./docs-internal/README.md): engineering, data-model, api,
finance-billing, ops, security, legal-trust, and the kill-criteria in
[`docs/KILL-CRITERIA.md`](./docs/KILL-CRITERIA.md).

## Development

```bash
bun install
bunx tsc --noEmit     # typecheck
bun run build         # build (also regenerates routeTree.gen.ts)
bun run lint          # eslint
```

Workflow: branch, PR, green CI (install, em-dash check, tsc, build), squash-merge. Vercel
auto-deploys `main` and builds previews on PRs. House style: no em dashes (CI enforces this on
`src/`).
