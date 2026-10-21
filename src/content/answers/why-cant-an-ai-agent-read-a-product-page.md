---
title: "Why can't an AI agent read a product page?"
description: "The eight reasons a machine fails to read a page, from a refusal to a JavaScript-only render, and what a site owner or an agent can do about each."
published: "2026-10-21"
updated: "2026-10-21"
tags: [machine readability, structured data, crawlers]
related:
  [
    how-can-an-ai-agent-get-typed-product-data-from-a-url-or-barcode,
    what-does-a-calibrated-confidence-score-mean-for-an-agent,
  ]
---

Because a plain request did not return typed facts a machine can extract without guessing. Legibility records which of eight reasons applies: a refusal, a JavaScript-only render, no structured data, not a product page, an extraction below the trust gate, a robots.txt disallow, a timeout, or an inconclusive read.

The distinction matters because the reasons have different causes and different owners. Refusing crawlers is a decision a site is entitled to make. Rendering only in JavaScript is usually an accident of how the site was built. A clean page with no markup is often a small fix.

## What readable means here

A page is readable when typed facts can be extracted without guessing, which in practice means JSON-LD or OpenGraph. Legibility tests that with one plain GET of the page, the way an answer engine's crawler would issue it, using the identified user agent `LegibilityBot/0.1`. There is no headless browser, and no proxy is used to get around a refusal. robots.txt is obeyed, and a site that disallows the bot is recorded as having chosen to, never worked around.

## The eight reasons

- [blocked](/why/blocked): the site refused the request.
- [js_shell](/why/js_shell): the content is assembled by JavaScript, so the plain HTML carries little to read.
- [no_structured_data](/why/no_structured_data): the page loads but carries no typed markup.
- [not_a_product](/why/not_a_product): what came back is not a product page.
- [low_confidence](/why/low_confidence): something was extracted, but it scored below the 0.7 trust gate.
- [robots_disallowed](/why/robots_disallowed): robots.txt asks machines not to read the page.
- [timeout](/why/timeout): the request did not complete in time.
- [error](/why/error): the read was inconclusive.

This is the whole set. Each page explains the mechanism, what it costs and who fixes it, and the [index of findings](/why) orders them by cost.

## What a site owner can do

Check one domain at [legibility.io](/#check) with no account to see which finding applies. Where the finding is a JavaScript-only render or missing structured data, serving `schema.org/Product` JSON-LD in the HTML response is the usual fix. Where the site has chosen to refuse machines, the finding is a decision rather than a defect, and it is reported that way.

## What an agent can do with a failed read

A failed `read_product` still returns a well-formed envelope with `product: null` and a confidence below the gate, so the agent can branch on it instead of parsing an error. Options include trying the product's GTIN, which goes through barcode sources rather than the page, or resolving a name with `resolve_product`. With an API key a failed read is not billed. See [how to get typed product data](/answers/how-can-an-ai-agent-get-typed-product-data-from-a-url-or-barcode).

## FAQ

### Does Legibility render JavaScript before deciding?

No. It makes one plain request with no headless browser, because that is the request an answer engine crawler issues, and a page that needs JavaScript to show its facts is recorded as `js_shell`.

### Does Legibility get around blocks or robots.txt?

No. robots.txt is obeyed and a refusal is recorded as a finding. A proxy-based fallback exists for bot-hostile sites but is switched off.

### Can I check my own site?

Yes. Enter a domain at legibility.io and get a verdict with no account and no payment.
