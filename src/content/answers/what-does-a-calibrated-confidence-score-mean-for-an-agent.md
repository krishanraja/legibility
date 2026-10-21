---
title: "What does a calibrated confidence score mean when an agent reads product data?"
description: "Why a calibrated confidence is a probability an agent can gate on, how Legibility measured its own, and where the number is looser."
published: "2026-10-21"
updated: "2026-10-21"
tags: [confidence, calibration, trust gate]
related:
  [
    how-can-an-ai-agent-get-typed-product-data-from-a-url-or-barcode,
    why-cant-an-ai-agent-read-a-product-page,
  ]
---

A calibrated confidence is a probability: a score of 0.7 means the result is about 70 percent likely to be correct. Legibility fits its scores with isotonic regression on a held-out labelled split and treats 0.7 as the trust gate, so an agent can decide to act, re-check or decline on a number that means something.

Most extraction tools return a score that measures how many fields were filled, or how sure a model sounded. Neither tells an agent how often results at that score are actually right, which is the only thing it needs to know before acting.

## Calibrated versus uncalibrated

An uncalibrated score orders results but does not say how often they are correct. A calibrated score is fitted against labelled outcomes so that, across many results, the stated number matches the observed rate of being right. That is what makes a fixed threshold meaningful: "act at 0.7 or above" becomes a statement about expected error rather than a guess.

## The measured figures, with their limits

Legibility's calibration was measured on a held-out test split of 63 labelled items, in evaluation run `iso-63-2026-07-05`:

- Precision at the 0.7 gate: 1.0, with a Wilson lower bound of 0.832.
- GTIN recall: 1.0. Adversarial rejection: 1.0.
- Expected calibration error across the full range: 0.19.

The honest reading is that the score is dependable at the gate and looser in the middle of the range. Sixty-three items is one evaluation run, which is a claim rather than a credential, so the sample size is published with the number. Every response carries `calibration_version`, so a stored score stays auditable after a recalibration.

## How an agent should use it

1. Gate on `confidence`. At 0.7 or above the object is treated as trusted; below it, treat the read as unknown.
2. Use `field_confidence` when one field matters more than the rest, for example acting on the price only when the price field clears your own bar.
3. Adjust the gate with `min_confidence` (0 to 1) when your task tolerates more or less risk than the default.
4. Store `legibility_id` and `calibration_version` with any decision you make from the read.
5. Close the loop with `report_outcome`, which records whether the answer led to a real result and is never billed.

## Why the gate is also the billing unit

With an API key, Legibility bills only trusted reads: a product returned at confidence 0.7 or higher. A miss or a below-gate read costs nothing and does not use quota. Charging for misses would reward the opposite of an honest gate. The method is described on the [home page](/#method) and in [the read_product answer](/answers/how-can-an-ai-agent-get-typed-product-data-from-a-url-or-barcode).

## FAQ

### Can I change the 0.7 threshold?

Yes. Pass `min_confidence` between 0 and 1 on `read_product`, `resolve_product` or `brief_product`, over REST or MCP.

### Is the score equally reliable at every value?

No. Expected calibration error across the full range is 0.19, so the score is most dependable at the gate and looser in the middle.

### How large was the evaluation?

A held-out test split of 63 items in one run. The figures are published with that sample size rather than as a headline alone.
