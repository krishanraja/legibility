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

**lgk\_ key.** Customer API key with `lgk_` prefix. sha256-hashed at
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

**Billable read.** A keyed call that returned a product AND overall
confidence >= 0.7, by any endpoint (`usage_events.billable`). It draws down
quota and is the unit billing counts. The kill metric in
`docs/KILL-CRITERIA.md` counts billable reads per active account.

**Trusted read (North Star).** Stricter: a billable read made through the
REST API (`/api/v1/*`) or MCP (`/api/mcp`) and carrying a non-empty
calibration version (`is_trusted_read()`). A testbench, quickstart or sample
read never counts. The North Star number is the count of external keys with
at least one trusted read in the ISO week (`northstar_weekly_keys()`),
internal accounts left out. A null or below-gate response is neither: it is
free and does not consume quota.

**Channel label.** Where an account came from, as one short label:
`internal`, `introduction`, `invitation`, `directory:<name>`,
`utm:<source>`, `referrer:<host>` or `direct`
(`account_acquisition_source()`).

**Internal list.** The accounts (and their keys) left out of the North Star:
Krish's own, the growth engine, CI, demos, smoke tests and the like belong on
it. Kept by an admin on `/dashboard/metrics` (`internal_accounts`,
`internal_keys`).

**Invitation id.** The growth engine's id for one invitation, carried in a
link's `utm_content` as `legibility:...` and kept with the touch, so a
builder can be traced to the invitation that brought them.

**Opaque id.** An id in the growth export: an HMAC of the database id under
`EXPORT_ID_KEY`, with a prefix (`acct_`, `key_`, `read_`, `evt_`, `sess_`).
Stable across exports, and never the database id itself.

**Trial.** A 30-day free trial an admin grants to one account, once: a
number of trusted reads (default 5,000) and its own cost fuse, no card,
nothing charged, then the Free plan (`trial_grants`).

**Wedge.** One of the five differentiators in [README.md](./README.md).
If a piece of copy or a product decision does not ladder to a wedge,
ask why we're shipping it.

**x402.** Open HTTP 402 micropayment standard. Legibility accepts test USDC
on Base Sepolia (testnet): the verify-and-settle flow is proven there, and
there is no mainnet settlement yet. Each attempt is one `x402_settlements`
row.

---

Last reviewed: 2026-10-27.
