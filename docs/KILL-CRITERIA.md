# Legibility: North Star and kill criteria

Decision record for the private beta. This is the bar Legibility must clear to keep going, and the
signals that say stop. The metrics are no longer theoretical: they are computed live in the DB by the
`northstar_weekly` and `trust_rate_by_method` RPCs over `usage_events`, the `subscriptions` table,
and `outcome_reports`, rolled up daily into `ops_daily`, and watched by `kill_dashboard()` on
`pg_cron`.

## North Star

**Weekly count of trusted reads per active account.** A read counts if it returned a product object
at or above the **0.7 trust gate**. Because confidence is now an isotonic-calibrated probability, the
gate reads literally: at or above 0.7 means "about 70 percent or more likely correct." An account is
active in a week if it made at least one call that week. This is the exact unit that
`northstar_weekly` computes.

Target for the beta: a typical active account makes **7 or more** trusted reads per week (roughly one
per day). That signals the data is trusted enough to wire into a real workflow, which is the whole
thesis.

## Supporting metrics

- **Trust rate**: share of calls returning at or above 0.7. Below ~0.6 means the extraction or
  confidence model is not earning trust. `trust_rate_by_method` breaks this out by source method
  (jsonld, shopify, barcode, opengraph), which is what tells you whether a dip is one bad source or
  the whole model. `ops_daily` records it every day.
- **Precision at the gate**: of the reads that cleared 0.7, the share that were actually correct.
  This is the calibration promise. It is measured on the held-out golden split and recorded in
  `golden_eval_runs`; the current measured value is precision 1.0 (Wilson lower bound 0.832). If live
  outcome reports show precision at the gate drifting below the golden baseline, the calibration is
  no longer honest and must be refit.
- **Repeat rate**: share of accounts that call in week N and again in week N+1. A leaky bucket here
  means the output is not useful enough to come back for.
- **Cache hit rate**: share of cached reads (cached hits now return real `field_confidence`). High is
  good for margin; very low means the corpus is too sparse to amortize.
- **Cost per trusted call**: extraction cost divided by trusted reads (calls at or above 0.7). Must
  stay well under the price charged. Nulls and below-gate reads are not billed, so they do not enter
  the numerator of what the customer pays, but they do carry real extraction cost, so watch this
  ratio as the honest-scope reduction shifts traffic toward structured-data sites.

## Kill criteria

Reconsider the product if, after eight weeks of beta with at least ten active accounts:

1. Median active account is below **3** trusted reads per week and not trending up, **and**
2. Week-over-week repeat rate stays below **30 percent**, **and**
3. Trust rate cannot be pushed above **0.6** without gaming the confidence score (that is, precision
   at the gate falls when the gate is loosened to lift the trust rate).

All three together means accounts try Legibility, do not trust the output, and do not return. That is a
thesis failure, not a tuning problem, and is the signal to stop rather than keep polishing.

## The live kill floor

The kill floor is now instrumented, not a manual read:

- `ops_daily` rolls up trust rate, volume, and the North Star every day.
- A **kill-floor alert fires when the trust rate drops below 0.60**. Outbound delivery (Resend via
  `pg_net`) is still to be wired, but the alert already computes and records, so the floor is
  observable in the DB today.
- `kill_dashboard()` runs on `pg_cron` and surfaces the North Star, trust rate by method, and
  precision at the gate on the admin `/dashboard/metrics` page.

The 0.60 alert is an early-warning tripwire on a single week's trust rate. The three-part kill
criteria above are the deliberate, eight-week decision. A single day under 0.60 is a signal to
investigate the source method; it is not by itself a kill.

## What is explicitly not a kill signal

- Low raw call volume early (private beta, small N, honest zero baseline in the metrics today).
- A single noisy source (fix the source, which `trust_rate_by_method` will isolate, not the product).
- Bot-hostile retailers returning null (a known, documented scope reduction, unblocked later by the
  dormant Bright Data fallback, not a trust-model failure).
- x402 settlement volume near zero in beta (it runs on Base Sepolia testnet with no live settlement
  yet; the wedge is discovery and trust first, settlement follows once agents depend on the data).
