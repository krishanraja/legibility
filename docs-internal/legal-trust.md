# Legal & Trust

## Status of legal pages

- `/terms`: interim text live (extraction and caching, price band, confidence, billing, x402,
  refunds), marked interim and pending counsel.
- `/privacy`: interim text live (what we collect, the cache, processors, retention, takedowns),
  marked interim and pending counsel.
- `/takedown`: live form, writes to `takedown_requests`.

The interim pages are honest about real behaviour. Counsel review is required before paid GA.

## DMCA / takedown process

1. Request via `/takedown` or `legal@<domain>`.
2. Acknowledge within 24h.
3. Verify the requester has standing (rights holder or authorised agent).
4. Purge cache rows keyed on the URL.
5. Add URL to the takedown blocklist (future calls return 451).
6. Notify the requester. Log the action.

The `product_cache` purge cron (every 30 minutes) also reaps any row flagged
`takedown = true`, so a takedown is enforced promptly even between reads.

## Fetch posture (robots / ToS / CFAA)

- We send a standard browser User-Agent, not a self-identified crawler UA. This
  was a correctness fix (bot UAs were served block pages and scored real products
  at 0), and it is honest about what we are: a client fetching the page a human
  would see.
- We do NOT force headless render on high-anti-bot retailers. Amazon, Walmart,
  Target, Best Buy, and eBay are structured-data-only: if they do not serve
  structured data to a plain fetch, we return nothing rather than driving a
  browser against them. This is a deliberate CFAA / ToS-conservative posture
  (`worker/src/render.ts`, `isHardDomain`).
- Render (Browserless) is used only when a cooperating page exposes no strong
  structured data to a plain fetch (JS-injected JSON-LD), never to defeat a block.

## Web Unlocker (blocked pages only)

Bot-hostile retailers (Apple, Nike, Lego, and similar) block Vercel's datacenter
IP. For those pages only, a fallback path can route the fetch through Bright Data's
Web Unlocker (`worker/src/unblock.ts`). The margin and legal posture is fixed in code:

- FALLBACK ONLY: escalates only when the plain fetch was actually blocked (403 / 429
  / 503 / network failure, a challenge/interstitial page, or a soft-redirect off host
  with nothing extracted). Shopify, GTIN, and cooperating structured-data sites never
  touch this path.
- PAY PER SUCCESS, cost-capped: Bright Data charges only on a returned page, the cost
  is stamped on the response, and we escalate at most once per request.
- DORMANT today: inert unless `BRIGHTDATA_API_TOKEN` and `BRIGHTDATA_ZONE` are set,
  which is a founder decision pending a Bright Data payment method and zone. Until
  then bot-hard retailers are best-effort and out of the trusted scope below.

## Honest data-source provenance

What "trusted" (a returned object at or above the 0.7 gate) actually covers today,
per the A-reduced scope decision (`worker/docs/decisions/og-scope.md`):

- Structured product data: JSON-LD that serves to a plain fetch, Shopify
  (`/products/{handle}.json` plus `/meta.json` for currency), and GTIN / barcode
  lookups (Open Food Facts and similar authoritative catalogs).
- OpenGraph pages that pass the content-validity check.
- Bot-hard / challenge-walled retailers are best-effort, returned below the gate or
  not at all, and are stated as a coverage limit on the landing page and docs. They
  are NOT sold as covered.
- Fuzzy name resolution (`resolve_product`) uses Exa retrieval; it returns nothing
  when Exa is out of credits, which is the honest current state.

We do not represent coverage we do not have. The public scope line is: "we read
structured product data and verified OpenGraph; challenge-walled retailers are
best-effort."

## PII policy

- We do not store buyer PII.
- The product cache is keyed on public references (URLs and GTINs) and contains
  public product metadata, plus per-field confidence, the calibration version, and
  the opaque `legibility_id`. No request-body content beyond the cache key.
- `usage_events` stores the API key id, the tool name, cost, latency, and the
  calibration-observation stamps (confidence, method/domain, `envelope_hash`,
  `calibration_version`, `request_id`, whether a product was returned, and the
  `billable` flag). Never the request body content beyond what is needed for cache
  lookup.
- `outcome_reports` (agents optionally reporting whether a Legibility answer led to a
  real purchase) is owner-scoped and stores only the outcome, an observed price /
  currency, and a note; no buyer identity.
- User account data: email (auth), display name, company name (optional).
  Deletable on request; we honour within 30 days.

## Confidence and price disclaimers

`confidence` (0 to 1) is a CALIBRATED probability: it is fitted (isotonic regression
on a held-out golden split) to estimate P(the returned product is correct), so 0.7
means roughly "70% likely correct". It is still a model output, not a guarantee.
Price is returned as a band with `as_of` and `n_sources`; we do not represent any
single price as live or transactional.

Customer-facing language: "Legibility's product data is best-effort and should not be
relied on for transactional pricing or regulatory purposes without independent
verification."

## x402 wallet custody

We do not custody customer funds. Settlements are per-call and immediate, straight to
`X402_RECIPIENT`. x402 runs on Base Sepolia (testnet) in the current beta: there is NO
live settlement yet, and the code is not to be described as processing real value.
For mainnet GA, move the payee to a secured wallet (multisig recommended). We do not
pool, lend, or rehypothecate received USDC.

## Data residency

Supabase (project `cgkcplcamsijghalintq`) hosts the primary database; the app and the
extractor worker both run on Vercel. The worker is deployable per region; v1 runs in a
single region. Customers with residency requirements should be quoted on the Custom
plan. The live surface today is `legibility.io`, delegated to Vercel with SSL issued.

## Audit

The `audit_log` table records: takedowns received and applied, key
revocations, admin actions, refund issuances. Retention: 7 years.

---
Last reviewed: 2026-07-06.
