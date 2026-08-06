# Support

Internal support guide. Legibility is live and in private beta on
https://legibility.io (the custom domain legibility.io is being
pointed at Vercel and DNS is still propagating). Every Legibility call is
synchronous: the caller sends a request and gets the typed product object,
its confidence, and the per-call cost back in the same response. There is no
async job, no polling, and no webhook to wait on.

## The one concept every ticket needs: the trusted read

A read returns a `confidence` that is a calibrated probability. 0.7 means
"about 70 percent likely to be correct." The gate is 0.7.

- **At or above the gate:** `product` is the typed object and
  `confidence >= 0.7`. This is a trusted read. It is billed and it counts
  against quota.
- **Below the gate:** `product` is `null` and the HTTP status is still 200.
  Legibility is saying "I could not stand behind this answer." A null read is
  **not billed and does not consume quota**. `billable` is set only when a
  product is returned AND confidence is at least 0.7.

So "I got `product: null`" is almost never a bug. It means the page scored
below the calibrated gate. What to tell the customer:

1. It cost them nothing and burned no quota.
2. To see the low-confidence object anyway, pass `min_confidence` in the
   body (for example `"min_confidence": 0.5`). They get the object plus its
   honest sub-gate confidence and decide for themselves.
3. A better reference lifts confidence. A GTIN or a structured-data product
   URL (JSON-LD or Shopify) beats a fuzzy name. Bot-hostile retailers
   (Apple, Nike, Lego) block our datacenter egress today, so those URLs
   legitimately return null until the residential-proxy fallback is switched
   on (built but dormant, founder-gated on a Bright Data zone and payment
   method).

## Common tickets

### "I lost my API key"

Keys are shown once and stored hashed. We cannot recover the original. Have
the customer create a new key and revoke the old one. Offer a 24-hour grace
period on the old key for migration.

### "I got product: null / confidence is low"

See "the trusted read" above. Below the gate is by design and is free. Have
them retry with a GTIN or a structured-data URL, or pass `min_confidence` to
inspect the sub-gate object. Only escalate to engineering if a clean
structured-data URL (JSON-LD, Shopify) or a valid GTIN returns null: that is
worth a look.

### "resolve_product isn't working"

`resolve_product` is synchronous and takes `{ "name": "..." }` (a string of
2 or more characters). There is no `res_` id and no
`GET /v1/resolutions/{id}`. That async shape never existed, so ignore any
old client that expects it. Name resolve runs on the worker via Exa
retrieval, so if Exa is out of credits the call returns nothing usable.
Check the Exa balance before escalating.

### "My usage / overage looks wrong"

1. Pull `usage_events` for the period. Only rows with `billable = true`
   (product returned, confidence at least 0.7) are charged. Null and
   low-confidence reads are logged but never billed.
2. Free tier is a hard stop at 1,000 trusted reads per month, with no
   overage and no card. Once the cap is hit the API returns 402 and the
   worker is never called.
3. Paid overage (Starter $0.01, Growth $0.005 per trusted read) is metered
   in `usage_events`. Automatic overage billing to Stripe is NOT wired yet
   (founder-gated on a live canary), so a mid-cycle overage will not appear
   on the Stripe invoice until that lands. If the numbers still do not
   reconcile after accounting for this, escalate with the key id and time
   range.

### "I hit a 402 and I'm on the free plan"

Expected. Free is a hard 1,000-trusted-read cap. The 402 body points to
`/dashboard/billing`. Upgrade to Starter or Growth to raise the cap.

### "x402 payment failed"

1. Confirm the network: Base Sepolia. x402 is testnet-only right now. There
   is no live mainnet settlement yet.
2. Confirm the asset is USDC on Base Sepolia.
3. Confirm the recipient matches `X402_RECIPIENT`.
4. If they are pointing at mainnet, that is the problem: mainnet settlement
   is not live.

### "Where are the webhooks?"

Webhooks do not exist. The `/docs/webhooks` page is an honest roadmap
placeholder. Do not promise a webhook or any event delivery. If a customer
needs product-change events (price moved, back in stock), log the request
and route it to the founder.

## Error catalog

Real HTTP responses from `/api/v1/*`. Error bodies are JSON with at least
`error` and `message`.

| HTTP | error | What happened | What to say |
| ---- | ----- | ------------- | ----------- |
| 200 + `product: null` | (none) | Below the calibrated 0.7 gate | Free, no quota used. Pass `min_confidence` or use a GTIN / structured URL. |
| 400 | invalid_json | Body was not valid JSON | Fix the request body. |
| 401 | unauthorized | Missing or bad plk_ key | Send a valid key as a Bearer token. |
| 402 | (quota) | Monthly quota exhausted | Upgrade. The body links `/dashboard/billing`. |
| 422 | invalid_request | read: not exactly one of `url`/`gtin`. resolve: `name` under 2 chars | Send one reference, or a real name. |
| 429 | rate_limited | Per-key burst or sustained rate exceeded | Honor `retry-after`. Upgrade for higher limits. |
| 502 | upstream_unavailable | The extraction worker did not respond | Retry. If persistent, page on-call. |
| 503 | external_worker_not_configured | Worker URL/token unset in this env | Ops issue: set `PLINTH_EXTRACTOR_URL` and `PLINTH_EXTRACTOR_TOKEN`. |

The public `/docs/errors` page also lists 403 `key_revoked`, 404
`not_resolvable`, and 451 `takedown`. 403 (revoked key or suspended account)
and 451 (URL under a takedown) are real states. 404 `not_resolvable` is
documented as the "could not resolve" case, but note the current worker
returns a 200 envelope with `product: null` for a below-gate read rather
than a 404. If a customer quotes a 404 as a hard error, confirm which
surface and input they hit.

## Canned responses

Live in the support inbox templates. Keep them short, factual, and free of
em dashes (see design.md). The "null is not a failure, it is free and
honest" explanation is the one you will send most.

## Escalation

| Severity | Definition                                         | Who                                |
| -------- | -------------------------------------------------- | ---------------------------------- |
| P0       | API down, billing wrong, data leak                 | Page on-call, status page update   |
| P1       | Single customer blocked, no workaround             | Reply within 4 business hours      |
| P2       | Bug with workaround                                | Reply within 1 business day        |
| P3       | Feature request / docs gap                         | Triage weekly                      |

## Refund policy (stub)

Full refund for documented platform errors (downtime, billing bugs). Null
and low-confidence reads are never charged in the first place, so there is
nothing to refund on them: that is the trusted-read billing unit, not a
refund case. Pro-rata refund on cancellation if a customer requests within
30 days of an annual plan.

---
Last reviewed: 2026-07-06.
