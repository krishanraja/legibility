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

| Plan    | Stripe product       | Price lookup key    | Monthly price | Included trusted reads | Overage         |
| ------- | -------------------- | ------------------- | ------------- | ---------------------- | --------------- |
| Free    | none (no card)       | none                | $0            | 1,000                  | none, hard stop |
| Starter | `Legibility Starter` | `plinth_starter_v1` | $29           | 5,000                  | $0.01/read      |
| Growth  | `Legibility Growth`  | `plinth_growth_v1`  | $199          | 50,000                 | $0.005/read     |
| Custom  | quote                | quote               | quote         | quote                  | quote           |

The lookup keys still read `plinth_*`. A Stripe lookup key cannot be
edited in place; changing one means minting a new price, which would
change the price IDs already stored in `plans.stripe_price_id`. The keys
are internal and nothing customer-facing renders them, so they are left
alone deliberately rather than by oversight.

**Status (2026-09-23):** live products and prices exist in Stripe
(Starter `price_1Tki9C4w6vAdI2o574L46LZW`, Growth
`price_1Tki9I4w6vAdI2o5NtBRlfk6`), wired to `plans.stripe_price_id`.
The live webhook endpoint `we_1UIxHl4w6vAdI2o5Fy6Rq25w` points at
`https://legibility.io/api/stripe/webhook` on all five handled events, and
the deployed handler was checked against it: an unsigned POST and a
wrongly signed POST are both rejected 400, and GET is 405. A billing
portal configuration (`bpc_1UIxS14w6vAdI2o5hHkD2b0H`) now exists; the
account had none, so `createPortalSession` would have failed at the first
click.

**Checkout cannot complete today, and the blocker is not in this repo.**
Account `acct_1Sapu84w6vAdI2o5` reports `charges_enabled: false` with the
`card_payments` capability **inactive**, while `details_submitted` is true
and `requirements` is null. Stripe's Checkout API refuses with "No valid
payment method types for this Checkout Session". The API cannot clear it:
`POST /v1/account` answers "You cannot use this method on your own
account: you may only use it on connected accounts." **Activating card
payments is a dashboard action on the Stripe account and is the single
remaining step before a first charge is possible.** No charge and no
subscription has ever been created on this account, so the live canary
above remains unrun.

**Cleanup outstanding:** webhook endpoint `we_1TkiCp4w6vAdI2o5Bqk7j1Y4`
still points at `https://plinth-tan.vercel.app/api/stripe/webhook`, a
Vercel project that was deleted and now returns 404. It is enabled on the
same five events and should be deleted in the dashboard.

Subscriptions are flat monthly in v1. Free requires **no card**.

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

The public terms say the same thing, and must keep saying it. Section 06
of `/terms` previously read "Overage above your included calls is billed
on the same invoice", which described a system that does not exist and
would have been the first thing quoted back at us in a billing dispute.
It now says usage above the allowance is measured and shown but never
charged without telling the customer first. If auto-metering ships, that
paragraph is part of the change, not a follow-up to it.

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
