# AGENTS.md

## Cursor Cloud specific instructions

Legibility is a single TanStack Start app (React 19 + TypeScript + Vite + Nitro, Supabase
data layer) that serves the marketing site, the dashboard, the REST `/api/v1/*` endpoints, and
the MCP server at `/api/mcp`. There is no separate service to boot in this repo; the real
extraction lives in a separate `legibility-worker` deploy that this app proxies to over HTTP.

### Toolchain

- The package manager is **bun** (`bunfig.toml`, `bun.lock`), not npm/pnpm. `bun` is installed at
  `~/.bun/bin` and on `PATH` via `~/.bashrc`. The update script reinstalls it if missing.
- `package.json` `engines` pins `node 24.x`, but the base VM ships Node 22 and every gate
  (install, tsc, lint, vitest, build, dev server) runs fine on it. No Node upgrade is required.
- Standard commands live in `package.json` scripts and are documented in `README.md`
  ("Development"). The CI gate sequence is in `.github/workflows/ci.yml`.

### Run / lint / test / build

- Dev server: `bun run dev` (Vite on `http://localhost:3000`). The warnings it prints about
  `*.test.ts` route files "not exporting a Route" are expected and harmless.
- Full CI gate order (mirror before pushing): `bun run format:check`, `bunx tsc --noEmit`,
  `bun run lint`, `bunx vitest run --coverage`, `bun run build`, `bun scripts/check-geo.ts`.
- Coverage is enforced at **100%** on the money-path surface (`src/lib/api/**`,
  `api-keys.server.ts`); `vitest.config.ts` treats a drop as a guardrail trip, not something to
  lower. The truth tests under `src/test/truth/**` hit the live network/DB and are excluded from
  the default run on purpose.
- House style: **no em dashes** in `src/`, `docs/`, `docs-internal/`, `public/`, `README.md`. CI
  greps for them and fails the build.

### Environment / secrets

- Copy `.env.example` to `.env` (gitignored) to run locally. Only the six `SUPABASE_*` /
  `VITE_SUPABASE_*` public vars are needed for the dev server to boot and render pages.
- Real Supabase, Stripe, and worker (`PLINTH_EXTRACTOR_URL` / `PLINTH_EXTRACTOR_TOKEN`) secrets
  are **not** present in this environment. Without them: pages render, MCP discovery
  (`initialize`, `tools/list`, `ping`) works, request validation works, and `tools/call` with no
  key correctly returns an HTTP 402 x402 payment quote. But live product reads,
  auth/dashboard flows, and `/api/health` returning `ok` require those real secrets and a
  reachable worker (`/api/health` reports `degraded` when the worker is unset, which is expected).
- The Supabase clients are lazily instantiated behind a Proxy, so a missing/placeholder env var
  only throws when a page actually touches Supabase, not at server startup.
