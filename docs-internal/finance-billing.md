# Finance & Billing

## The billing unit: the trusted read

Legibility bills **trusted reads**, not raw calls. A `usage_events` row is
`billable = true` only when the response **returned a product AND
confidence >= 0.7**. Everything else (a null read, or a product below the
gate) is logged for calibration and metrics but charges nothing and does
**not** consume monthly quota.

Confidence is a **calibrated probability**, not a heuristic score. The
worker runs a content-validity stage (`worker/src/isproduct.ts`, a Haiku
verifier behind `PLINTH_LLM_VERIFY`, deterministic-first), a rewritten
`confidence.ts`, and isotonic calibration (`worker/src/calibrate.ts` +
`calibration.json`). Because the score is calibrated, the 0.7 gate means
"about 70% likely to be correct." That is the North Star unit: we take
money for answers an agent can trust, and only those.

Measured on a held-out golden test split: precision at the gate 1.0
(Wilson lower bound 0.832), adversarial rejection 1.0, GTIN recall 1.0,
zero crashes. Each billable read stamps `confidence`, `method`, `domain`,
`envelope_hash`, and `calibration_version` for audit and later recalibration.

## Stripe SKUs

| Plan    | Stripe product       | Monthly price | Included trusted reads | Overage        |
| ------- | -------------------- | ------------- | ---------------------- | -------------- |
| Free    | `plinth_free`        | $0            | 1,000                  | none, hard stop |
| Starter | `plinth_starter_v1`  | $29           | 5,000                  | $0.01/read     |
| Growth  | `plinth_growth_v1`   | $199          | 50,000                 | $0.005/read    |
| Custom  | `plinth_custom_*`    | quote         | quote                  | quote          |

**Status (2026-07-06):** live products and prices exist in Stripe
(Starter `price_1Tki9C4w6vAdI2o574L46LZW`, Growth
`price_1Tki9I4w6vAdI2o5NtBRlfk6`), wired to `plans.stripe_price_id`.
Checkout construction and the signature-verified webhook are built and
proven in Stripe **test** mode (session, subscription, and `invoice.paid`
all fire). Production runs on a **live** Stripe key with **live** price
IDs, so a real end-to-end checkout is a live charge: that **live canary
has not been run yet and is a founder action**. Subscriptions are flat
monthly in v1. Free requires **no card**.

## Quota enforcement

- **Before the worker call**, `entitlement_check` (RPC) decides whether
  the account may spend. If the account is over its included trusted
  reads with no overage headroom (Free is a hard stop), it returns
  **402** before the worker ever runs, so a null or an over-quota request
  costs Legibility nothing.
- A **free cost fuse** backstops the Free tier: even if quota accounting
  drifted, Free-tier spend is capped so an abusive caller cannot run up
  real COGS. Free is a hard stop, not metered overage.

## Overage

```
billable_reads = count(usage_events where product is not null and confidence >= 0.7)
overage_cost   = max(0, billable_reads - included_reads) * overage_rate
```

- **Free:** no overage. At 1,000 trusted reads the account hard-stops and
  is prompted to upgrade. No card, no surprise bill.
- **Starter / Growth:** overage accrues per trusted read over the included
  count, at the plan rate.

**Not yet auto-billed.** Overage is **measured** in `usage_events` but is
**not yet reported to Stripe as metered usage**. Auto-overage-to-Stripe is
a roadmap item, founder-gated on the live canary (we do not push a first
metered charge to a customer until the live-Stripe path has been proven
end to end once). Until then, overage is a reporting figure, not an
automatic invoice line.

## x402 settlement

- **Status:** implemented on **Base Sepolia** (testnet). The verify-then-
  settle path exists in code, but **no live settlement has occurred yet**;
  it is blocked on a Base Sepolia faucet top-up (founder action). Treat
  x402 revenue as **$0 to date**. Mainnet is a later milestone, not GA-gated
  copy we should ship as if live.
- Per-call USDC settles directly to `X402_RECIPIENT`; we do not custody funds.
- x402 and Stripe are independent payment paths. Paying over x402 does not
  credit a Stripe account.
- For accounting, x402 revenue is reconciled from on-chain settlement
  events (each call's `X-PAYMENT-RESPONSE` carries the tx hash), once real
  settlements exist.

## COGS

Per-read cost is logged on every `usage_event` (`cost_internal_usd`,
server-only). Margin = `cost_usd` (the price stamped in the response)
minus `cost_internal_usd`. Watch the weekly weighted margin in admin
(`/dashboard/metrics`).

Cost structure by path:

- **Structured-data reads** (serving JSON-LD, Shopify via `/meta.json`,
  GTIN/barcode, verified OpenGraph): cheap. A fetch plus the Haiku
  content-validity check when it fires. The verifier is deterministic-first,
  so the Haiku cost is only incurred when structured signals are ambiguous;
  it is a fraction of a cent per read at most.
- **Cached trusted reads:** near-zero COGS. A cache hit returns the stored
  product with real `field_confidence` (columns `field_confidence`,
  `calibration_version`, `legibility_id` on `product_cache`) without a fresh
  fetch, so its margin is close to 100%.
- **Hard, bot-hostile retailers** (Apple, Nike, Lego): the datacenter IP is
  blocked. A **Bright Data Web Unlocker fallback** exists
  (`worker/src/unblock.ts`, fallback-only, pay-per-success, cost-capped) at
  roughly **$0.003 per successful read**. It is currently **DORMANT**,
  pending a Bright Data payment method and zone. When enabled, margin on
  these hard reads runs about **40% to 75%**: against the $0.005 Growth
  overage rate a $0.003 success is ~40%, and against the $0.01 Starter
  overage rate it is ~70%. Bundled into an included allotment the effective
  margin sits inside that band. Because it is fallback-only and
  pay-per-success, it never charges Legibility for a read it did not deliver.
- **Name-resolve** (Exa) has a per-query cost and only works when Exa has
  credits.

Investigate if the weekly weighted margin drops below 60%. The Web Unlocker
path is the one to watch, since it is the thinnest-margin read and the only
one with a true per-success external cost.

## Invoicing

- Stripe invoices are mirrored to the `invoices` table for in-app history.
- Custom plans get a manual invoice via Stripe.
- Tax: collected via Stripe Tax once domiciled.

## Revenue recognition

- Subscription: monthly straight-line.
- Overage: at invoice date (once metered reporting is live; today it is a
  measured figure only).
- x402: at settlement (none to date).
- Custom annuals: ratable over the term.

## Refunds

See [support.md](./support.md). Process via Stripe; mirror to `invoices`.

---
Last reviewed: 2026-07-06.
