# Legibility: outstanding checklist

The 2026-07 fix run is complete and verified. The engine now works (it returns real trusted objects
and separates products from non-products at measured precision), billing runs on the trusted-read
unit with quota enforced, and the trust instrumentation and monitoring are live. What remains is a
short list of items that need a human action or an external clock. Last updated 2026-07-06.

## Founder actions (blocking GA)

- [ ] **Rotate the exposed secrets.** Delete the old `sk_live` Stripe secret keys that were pasted
      in chat (Stripe Dashboard, Developers, API keys), and reset the `cgkc` Supabase service-role
      key. Creating a new key does not revoke the old one, and nothing in production depends on the
      old ones anymore. A `gitleaks` gate is now in CI to stop future leaks.

- [ ] **Add a Bright Data payment method and zone.** The Web Unlocker fallback for bot-hostile
      retailers (Apple, Nike, Lego and similar) is built and cost-capped in the worker
      (`worker/src/unblock.ts`) but **dormant**: it needs a Bright Data account with a payment method
      and a configured zone before those domains can return a trusted object. Until then, the honest
      scope is structured data plus verified OpenGraph (see `worker/docs/decisions/og-scope.md`).

- [ ] **Top up Exa credits.** Fuzzy-name `resolve_product` is wired and synchronous, but neural
      search returns nothing when the Exa account is out of credits. Fund Exa to make name-resolve
      live.

- [ ] **Run the Stripe live canary.** Checkout and the signature-verified webhook are verified in
      test mode. To close the last billing gaps (test/live isolation, webhook idempotency, and
      **metered overage reported to Stripe**, which is not yet wired), provide an `sk_test_` key for
      the agent to drive, or authorize one refunded live charge as a canary. Auto-overage-to-Stripe
      stays off until this passes.

- [x] **Point `legibility.io` at Vercel.** Done. DNS is delegated, SSL is issued, and
      `https://legibility.io/api/health` returns `status: ok`. `APP_ORIGIN` in
      `src/config/product.ts` is set to `https://legibility.io`.

- [x] **Redirect the dead `onplinth.io` to `legibility.io`.** Done 2026-08-06. It was verified
      at account level but attached to no project, which is why it served
      `DEPLOYMENT_NOT_FOUND`. Both `onplinth.io` and `www.onplinth.io` are now on the
      Legibility project as 308 redirects to `legibility.io`, so nothing under the old name is
      orphaned. Verified live.

- [x] **Make the apex canonical and remove the duplicate host.** Done 2026-08-06. Vercel had
      `www.legibility.io` as primary with the apex 308-ing to it, while every piece of
      metadata (`APP_ORIGIN`, `og:url`, JSON-LD, robots, mcp.json and all 12 sitemap URLs)
      declared the apex. Every sitemap URL therefore redirected. Flipped: the apex is now
      primary and `www` redirects to it, so sitemap URLs return 200 directly. Also removed
      `plinth-tan.vercel.app`, which was still serving a complete third copy of the site under
      the old brand.

- [x] **Enable leaked password protection.** Done 2026-08-06 via the Supabase Management API.
      `password_hibp_enabled` is now true and the minimum password length is raised from 6 to 10. The corresponding Supabase security advisor WARN is cleared.

- [ ] **Repoint `PLINTH_EXTRACTOR_URL` at `legibility-worker.vercel.app`.** The worker project
      already has both `legibility-worker.vercel.app` and `plinth-worker.vercel.app` attached
      and both serve the same deployment, so the swap is safe. The endpoint path is `/extract`
      (confirmed by probing: `/extract` returns 401, every other path returns 404), so the new
      value is `https://legibility-worker.vercel.app/extract` for both production and preview.
      The env var is marked **sensitive**, so its current value cannot be read back through the
      API to confirm. Once swapped and redeployed, check `/api/health` still reports
      `worker: ok`, then detach `plinth-worker.vercel.app`. The worker's own health body still
      self-identifies as `"service":"plinth-worker"`, which is a change in the worker repo.

- [ ] **Decide how CI reaches preview deployments.** SSO protection is on for
      `all_except_custom_domains`, so previews require a Vercel login. Phase 3 of
      `docs/AUTONOMOUS-HARDENING-PLAN.md` runs Playwright, axe and Lighthouse against the
      preview, which needs either a Protection Bypass for Automation token (recommended: keeps
      previews private) or disabling SSO protection (not recommended: makes every preview
      world-readable).

- [ ] **Repoint the Stripe webhook URL** to the new origin.

- [ ] **Counsel review of the interim legal** (`/terms`, `/privacy`) before paid GA.

- [ ] **Flip to paid GA** when ready (the go-live decision).

## Founder actions (optional / verification)

- [ ] **x402 live settlement.** The full flow is proven end to end: a real signed payment reaches the
      facilitator and returns `insufficient_balance`, so only funds are missing. For an on-chain
      `200`, the agent generates a persistent buyer wallet, you drip it a little Base Sepolia USDC
      from a faucet, and the agent runs the buyer client once.

- [ ] **Design partners.** The moat is outcome-closing traffic: agents reporting, via
      `POST /api/v1/report_outcome`, that a Legibility answer led to a real buy. Line up 2 to 3
      procurement or catalogue design partners so real outcomes start compounding into the golden
      set and `trust_rate_by_method`. This is a commercial action, not an engineering one.

## Agent will do automatically when unblocked

- [ ] **Repoint to `legibility.io`** the moment DNS resolves to Vercel (see above).
- [ ] **Enable metered overage** once the Stripe live canary passes.
- [ ] **Turn on the Bright Data fallback path** once the account, payment method, and zone exist.
- [ ] **Update the Vercel env** if any further key rotations happen (paste the new key).

## Agent-doable follow-ups (not yet built)

- [ ] **Onboarding "Run it now" inline first call** (the magic-moment UX on the dashboard).
- [ ] **Alert delivery** (Resend via `pg_net`) for the kill-floor alert, once the channel and key
      exist. The alert itself already computes and records; only outbound delivery is pending.
- [ ] **Metered-overage reporter**, verified end to end (blocked on the Stripe live canary above).

## Done and verified (the fix run)

- **Engine works.** Content-validity stage (`worker/src/isproduct.ts`, deterministic-first with a
  Haiku verifier behind `PLINTH_LLM_VERIFY`), rewritten `confidence.ts` (coverage trap killed, fuzzy
  title clustering, OpenGraph prior), and isotonic calibration (`worker/src/calibrate.ts` +
  `calibration.json`). Confidence is now a calibrated probability. On a held-out golden split:
  precision at the gate 1.0 (Wilson lower bound 0.832), adversarial rejection 1.0, GTIN recall 1.0,
  zero crashes. `extractProduct` never throws (null envelope on hard domains); the fetch uses a
  browser User-Agent; Shopify currency resolves via `/meta.json` so bands form.
- **Billing on the trusted-read unit.** `usage_events.billable` = product returned AND
  `confidence >= 0.7`; nulls and below-gate reads cost nothing and do not consume quota. Free =
  1,000 trusted reads / mo, hard stop, no card. Starter $29 / 5,000, Growth $199 / 50,000. Monthly
  quota enforced by the `entitlement_check` RPC (`402` before the worker call) plus a free cost fuse.
- **Trust instrumentation and moat seeds.** Opaque `legibility_id` minted per trusted product and stable
  across reads; every call stamped with confidence / method / domain / envelope hash /
  `calibration_version`; `outcome_reports` table + `POST /api/v1/report_outcome`; `golden_eval_runs`
  records precision at the gate; `product_cache` returns real `field_confidence` on hits.
- **North Star and monitoring.** `northstar_weekly` and `trust_rate_by_method` RPCs, an admin
  `/dashboard/metrics` page, an `ops_daily` rollup, a kill-floor alert at 0.60 trust rate, and
  `kill_dashboard()` on `pg_cron`. All live in the DB with an honest zero baseline (no real traffic
  yet in private beta).
- **Surfaces reconciled.** Real captured-call hero (no fabricated object), working mobile nav,
  copy-paste curls that succeed verbatim, and the beta-theater and vapor-webhook copy removed. GET on
  POST-only API routes now returns `405`.

The full fix map is in the audit `FIX-STATUS.md`. See `KILL-CRITERIA.md` for the North Star and the
now-live kill dashboard, and the repo `_STATE.md` for the live build ledger.
