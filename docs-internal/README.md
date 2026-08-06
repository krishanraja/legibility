# Legibility · Internal Project Documentation

You are an AI agent (or human) picking this project up cold. Read this file
first, then jump to the role document that matches your task.

## What Legibility is

A typed product-data primitive for software agents. One call turns a URL,
a GTIN, or a fuzzy name into a typed product object with per-field
confidence, the per-call cost stamped in the response, and an MCP +
x402 surface so an autonomous agent can discover and pay for it without
human signup.

**Status (2026-06-21): live and in private beta.** All four tools, key
auth, metering, rate limiting, the dashboard, Stripe billing, and x402
settlement on Base Sepolia are deployed. App at https://legibility.io
(custom domain `legibility.io` provisioning). The developer-facing front door
is the repo-root [README.md](../README.md).

## The five wedges (memorise these)

1. **MCP-native + x402 micropayments.** Diffbot, Zyte, Bright Data, Firecrawl all require an account and an API key. We expose the same tools over MCP and accept USDC on Base per call.
2. **Cost stamped in the response.** Every call returns `cost_usd`. Competitors charge opaque credit bundles.
3. **Per-field confidence with a cache gate.** Confidence is computed per field and overall. Only results with overall confidence ≥ 0.7 are cached.
4. **Price as a band, not a number.** `{ low, high, currency, as_of, n_sources }`. We refuse to pretend a single scraped number is the truth.
5. **One typed schema across URL, GTIN, and fuzzy name.** Most stacks compose 2 to 3 vendors to cover these three lookup modes.

If you change any of these, update this file AND `docs-internal/product.md`.

## Routing table

| You are working on...                     | Read                                |
| ----------------------------------------- | ----------------------------------- |
| Product strategy, roadmap, positioning    | [product.md](./product.md)          |
| Code, schema, server functions, routes    | [engineering.md](./engineering.md)  |
| Tables, RLS, retention                    | [data-model.md](./data-model.md)    |
| REST, MCP, x402, webhooks, rate limits    | [api.md](./api.md)                  |
| Visual system, voice, logo usage          | [design.md](./design.md)            |
| Selling, ICP, objections                  | [sales.md](./sales.md)              |
| Launch, channels, messaging               | [marketing.md](./marketing.md)      |
| Runbooks, incidents, rotations            | [ops.md](./ops.md)                  |
| Customer support, common tickets          | [support.md](./support.md)          |
| TOS, privacy, takedown, PII, custody      | [legal-trust.md](./legal-trust.md)  |
| Plans, overage, Stripe, x402 settlement   | [finance-billing.md](./finance-billing.md) |
| Auth, RLS posture, secrets, abuse         | [security.md](./security.md)        |
| Branching, commit style, ship checklist   | [contributing.md](./contributing.md) |
| Definitions of any unfamiliar term        | [glossary.md](./glossary.md)        |

## Public docs

The repo-root [README.md](../README.md) is the developer front door (quickstart, tools, auth).
Customer-facing docs live at `/docs/*` (file routes under `src/routes/docs.*.tsx`). The
North Star and stop conditions are in [../docs/KILL-CRITERIA.md](../docs/KILL-CRITERIA.md).
Internal docs (this directory) carry the "why" and the things we will never put on a marketing page.

## Keeping docs in sync

This README is the load-bearing index. When you change a load-bearing
rule here (or in any role doc), update this README in the same pass.

---
Last reviewed: 2026-06-21. If this is wrong, fix it and update the affected role doc.
