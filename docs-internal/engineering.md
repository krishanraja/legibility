# Engineering

## Stack

- **Framework:** TanStack Start (React 19, SSR, file-based routing) on Vite, built with Nitro.
- **Hosting:** Vercel (Node / Fluid Compute functions, not edge). `main` auto-deploys; PRs get
  preview deploys. `src/server.ts` is the Nitro entry.
- **Styling:** Tailwind v4 via `src/styles.css`, semantic tokens only (Editorial Warm).
- **Backend:** Supabase, the project named in `supabase/config.toml` (own project since
  2026-09-23; the earlier one now belongs to CTRL; Lovable has been ejected).
  Postgres 17, RLS on every table, PostgREST, Auth, `pg_cron` for the cache purge and the daily
  ops rollup / kill-floor check.
- **Extraction:** a separate worker (see below). The core extractor path is deterministic-first;
  an LLM content-validity check runs only on the ambiguous tail (behind `PLINTH_LLM_VERIFY`, with a
  conservative fallback), and `resolve_product` uses Exa for name retrieval.

## Architecture (request path)

```
agent / MCP client
  -> app on Vercel  (src/routes/api/v1/*, /api/mcp)
       auth (lgk_ key) -> rate limit -> entitlement_check (402 quota/cost fuse)
       -> worker on Vercel  (POST /extract, Bearer LEGIBILITY_EXTRACTOR_TOKEN)
            fetch (browser UA, never throws)
            deterministic extractors: JSON-LD, Shopify, OpenGraph, barcode/GTIN
            [unblock fallback: Bright Data Web Unlocker, blocked pages only, DORMANT]
            [render fallback: Browserless, only when no strong structured data]
            content-validity stage (isproduct.ts): deterministic-first + Haiku verifier
            confidence.ts (raw score) -> calibrate.ts (calibrated probability) -> 0.7 gate
       <- typed ProductEnvelope
       meter into usage_events (billable + calibration stamps), mint/return legibility_id
```

The app never extracts; it proxies to the worker over HTTPS with `LEGIBILITY_EXTRACTOR_TOKEN`. Keeping
extraction out of the SSR app keeps the app functions small and lets the worker run heavy work
elsewhere.

## Repo layout

```
src/
  routes/
    _authenticated/     route gate, dashboard pages (overview, keys, usage, billing, webhooks,
                        metrics, waitlist with its Trials tab)
    api/
      v1/               REST tools: read_product, resolve_product, compare_products,
                        brief_product, report_outcome
      mcp.ts            MCP JSON-RPC server (free discovery, paid read + resolve)
      internal/growth/export.ts   the growth engine's row-level export (A4)
      stripe/webhook.ts Stripe webhook (manual HMAC verify)
      health.ts         /api/health probe
    [.]well-known.*     /.well-known/mcp.json and /.well-known/mcp-registry-auth (A6, A7)
    founding-200.tsx    the Founding 200 page (A3)
    terms.tsx, privacy.tsx, docs.*.tsx   public pages
  components/           UI (site/, auth/, admin/, founding/, docs/, answers/, ui/ shadcn)
  config/product.ts     APP_ORIGIN and product-level config
  lib/
    auth.tsx            AuthProvider + useAuth
    api/                billing.functions.ts, x402.server.ts, keys.functions.ts,
                        meter.ts (stampFromResponse), metrics.functions.ts, and the A1 to A8
                        rules: internal-accounts, attribution, growth-export, founding,
                        mcp-tools, x402-ledger, trial; their server functions are
                        internal, attribution, founding and trials .functions.ts
  integrations/supabase/  client(s), api-keys.server, rate-limit.server,
                          entitlement.server, generated types
supabase/migrations/    SQL, append-only
docs-internal/          this directory      docs/  public-facing decision records
```

## Route + server-function conventions

- File names use dots (`dashboard.billing.tsx` -> `/dashboard/billing`).
- `_authenticated/route.tsx` guards dashboard routes.
- Customer-callable HTTP endpoints are `createFileRoute(...).server.handlers`. Server-only modules
  (`*.server.ts`, anything importing `supabaseAdmin` or secrets) are dynamically imported inside the
  handler so they never reach the client bundle.
- App-internal mutations use `createServerFn` in `*.functions.ts`, chaining
  `.middleware([requireSupabaseAuth])`; admin surfaces also check `has_role(auth.uid(), 'admin')`.
- `src/start.ts` registers `attachSupabaseAuth` globally; do not remove.
- `routeTree.gen.ts` is generated at build. After adding a route, build before committing so the
  committed tree includes it (and tsc stays green).

## read_product path (representative)

`read_product` validates the `lgk_` key, enforces the per-plan rate limit, calls `entitlement_check`
(402 with an upgrade link on `quota_exceeded`, `cost_fuse` or `trial_used_up`, BEFORE any
worker cost), proxies
`{ url | gtin, min_confidence? }` to the worker, and meters the call into `usage_events`. The metering
row is a calibration observation, not just a billable count: it stamps `confidence`, `product_returned`,
`billable` (product present AND confidence >= 0.7), `domain`/method, `envelope_hash`, `request_id`, and
`calibration_version`. The write is awaited (serverless freezes the function after the response).

## External worker (the engine)

A separate deploy (`krishanraja/legibility-worker`, Vercel, Node). `worker/src/`:

- **`server.ts`** exposes `POST /extract` (Bearer, the shared worker token, constant-time check,
  fails closed without the token) and `GET /health`.
- **`extract.ts`** deterministic extractors: JSON-LD (schema.org Product across arrays / `@graph`),
  OpenGraph, and Shopify (`/products/{handle}.json` for fields plus `/meta.json` for currency so a
  real price band forms). Fetch uses a standard **browser User-Agent** (a self-identified bot UA was
  served block pages and scored real products at 0) and NEVER throws: a network error, timeout, or
  block returns a sentinel (status 0, empty HTML) so the orchestrator degrades to a clean null
  envelope. A final URL on a different host is flagged `redirected` (soft-redirect trap).
- **`barcode.ts`** GTIN / barcode lookup against authoritative catalogs.
- **`render.ts`** headless-render fallback (Browserless), used only when a page exposes no strong
  structured data to a plain fetch (JS-injected JSON-LD). It NEVER force-renders high-anti-bot
  domains (Amazon, Walmart, Target, Best Buy, eBay): structured-data-only there.
- **`unblock.ts`** Bright Data Web Unlocker fallback for bot-hostile retailers that block the
  datacenter IP. Fallback-only (escalates once, only when the plain fetch looks blocked and no strong
  structured source was found), pay-per-success, cost stamped. DORMANT unless `BRIGHTDATA_API_TOKEN`
  and `BRIGHTDATA_ZONE` are set.
- **`isproduct.ts`** the content-validity stage: "is this ONE specific, purchasable product?"
  Deterministic-first (hard non-products such as 404 / homepage / listing / off-host redirect
  collapse to ~0; title + price + id scores ~0.98), with a Haiku 4.5 verifier (`PLINTH_LLM_VERIFY`,
  `ANTHROPIC_API_KEY`) only on the genuinely ambiguous tail. If the verifier is unavailable, an
  ambiguous page falls back BELOW the gate, so an unverified page is never served as trusted.
- **`confidence.ts`** the aggregation rewrite. Noisy-or over method priors (OpenGraph prior raised
  to 0.72, not structurally capped), titles clustered by normalized Jaccard similarity so a benign
  `" | Brand"` suffix is not a conflict, and identity = title plus its single best corroborator
  (price, id, or brand). This killed the old coverage trap that capped a title-only product at ~0.686.
  The content-validity score multiplies in, so a 404 with an `og:title` collapses to ~0.
- **`calibrate.ts` + `calibration.json`** isotonic calibration. Maps the raw score to a calibrated
  probability P(returned product is correct), fitted on the golden CALIBRATE split. After this,
  `confidence` is a probability: 0.7 means "at least 70% likely correct", which is the North Star
  unit. Absent a fit, calibration is the identity so the engine still runs. `calibration_version` is
  stamped on every response and metering row.
- **`resolve.ts`** fuzzy-name resolution: Exa neural search to candidate URLs, then extract the best,
  letting the content-validity stage make the final call per candidate. Returns nothing when Exa is
  out of credits.

Measured on a held-out golden test split: precision at gate 1.0 (Wilson lower bound 0.832),
adversarial rejection 1.0, GTIN recall 1.0, zero crashes. See `worker/docs/decisions/og-scope.md` for
the A-reduced coverage scope (structured data + verified OpenGraph; bot-hard retailers best-effort).

## Env vars (app)

- `LEGIBILITY_EXTRACTOR_URL`, `LEGIBILITY_EXTRACTOR_TOKEN`: the worker.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: billing.
- `X402_RECIPIENT`: the Base Sepolia (testnet) payee. `X402_FACILITATOR`, `X402_NETWORK`,
  `X402_ASSET`, `X402_PRICE_ATOMIC` are optional (sane Base Sepolia defaults live in `x402.server.ts`).
- `APP_ORIGIN` (in `src/config/product.ts`, `https://legibility.io`) is the one public origin.
  `APP_BASE_URL` optionally overrides it for Stripe checkout and portal return links only.
- `CHECK_SIGNING_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO`: the free check's
  capture and its email.
- `GROWTH_EXPORT_TOKEN_SHA256`, `EXPORT_ID_KEY`: the growth export (A4) and the Founding 200 IP
  hash. `MCP_CONTACT_EMAIL`, `MCP_REGISTRY_AUTH_PUBLIC_KEY`: the MCP manifest and registry (A6,
  A7). `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: the Founding 200 challenge (A3).
  `FOUNDING_AUTO_TRIAL`: automatic trials (A8). `VERCEL_GIT_COMMIT_SHA` is set by Vercel.
  Each is described in `.env.example`.
- Supabase URL + publishable key (`VITE_*`) for the client; service role for server-only admin.

Worker env (names as the worker repository defines them): the shared worker token, `EXA_API_KEY` (resolve), `BROWSERLESS_API_KEY` (render),
`ANTHROPIC_API_KEY` + `PLINTH_LLM_VERIFY` (content-validity verifier), `BRIGHTDATA_API_TOKEN` +
`BRIGHTDATA_ZONE` (Web Unlocker, dormant), Supabase service role. `process.env.*` is server-only:
read it inside the handler, never at shared-module scope.

## Local dev and deploy

```bash
bun install
bunx tsc --noEmit
bun run build      # also regenerates routeTree.gen.ts
bun run lint
```

Ship: branch, PR, green CI, squash-merge. CI (`.github/workflows/ci.yml`) is gitleaks
`secret-scan` plus a `verify` job where every step is a hard gate: install, the em dash check,
format check, tsc, lint, vitest with coverage (including the PGlite migration tests in
`src/test/db/`), build, the calibration and plan database checks (when the service-role secret is
present), the `llms-full.txt` check and the GEO check. `docs-internal/contributing.md` has the
detail. Vercel deploys `main` automatically. A migration is written in `supabase/migrations/`,
tested in PGlite, applied to the project named in `supabase/config.toml`, and only then is code
that reads it merged.

---

Last reviewed: 2026-10-27.
