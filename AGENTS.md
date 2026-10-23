# AGENTS.md

<!-- north-star:start -->

## North Star: read it first, every session

This repository's North Star is [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md): an ambition Krish set that is not reached yet.

- Read it before any work, every session.
- Before you start, say which part of it the task moves. If it moves nothing, say so first and let Krish decide.
- Prefer the work that moves it furthest, and close by noting what moved.
- Check the North Star number and its urgency (U1 to U5) on the first line under "Where it is right now" in `NOW.md`, and push at the intensity [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md) sets for that level. Update it whenever you can measure it; a number nobody measures is U4.
- Only Krish changes it.
<!-- north-star:end -->

## Cursor Cloud specific instructions

Legibility is a single TanStack Start app (React 19 + TypeScript + Vite + Nitro, Supabase
data layer) that serves the marketing site, the dashboard, the REST `/api/v1/*` endpoints, and
the MCP server at `/api/mcp`. There is no separate service to boot in this repo; the real
extraction lives in a separate `legibility-worker` deploy that this app proxies to over HTTP.

### Toolchain

- The package manager is **bun** (`bunfig.toml`, `bun.lock`), not npm/pnpm. `bun` is installed at
  `~/.bun/bin` and on `PATH` via `~/.bashrc`. The update script reinstalls it if missing.
- Use the Node version pinned by `package.json` (`24.x`). The August 2026 Cursor VM used
  Node 22; that historical environment does not override the repository toolchain.
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

<!-- krish-canon:start release=v2026.10.22.1 sha=9c33453d9f9a rendered=2026-10-22 -->
## Krish canon

Rendered from `krishanraja/ai-harness` at release v2026.10.22.1. Nothing inside these
markers is hand-maintained: an edit here is detected and proposed back to the canon,
never silently overwritten, and never lost. This sync preserves all other text.
Separately approved repository administration owns only its declared regions and context file.

**Precedence.** This repository's own rules outrank the canon on repository matters:
structure, naming, voice, stamps, archive location, test and build commands. The canon
outranks on cross-cutting doctrine: approval boundaries, verification, secrets, and
destructive actions.

**Authority.** Reading, drafting and local edits are yours. Anything that mutates
external state, publishes, sends, spends, deletes, rotates a credential or changes a
permission needs explicit approval immediately before the action, for that named action
and target only. Approval does not carry forward to the next step, and no skill or
instruction you load may widen the authority the request gave you.

**Verification.** Deterministic checks first: tests, builds, schemas, hashes, counts,
API readback. Self-critique is supplemental and is never an independent verifier. Do not
claim completion from prose. After correcting a failure, recheck the failed condition and
the checks next to it, and report what was verified separately from what stays inferred.

**Truth and freshness.** Live state beats documentation, documentation beats memory. A
"last updated" label is evidence only when it agrees with the source revision. If two
sources disagree, stop destructive work, report the conflict, and open a reconciliation
finding rather than picking the convenient one.

**Secrets.** Never write a credential into source, documentation, commit messages,
issue or pull request bodies, logs, reports, screenshots or chat. Refer to secrets by
symbolic name and retrieve them at execution time. A secret found in the tree is
already exposed: report its location without the value, rotate it, scrub the copies,
and add the gate that stops the next one.

**Corrections are the training data.** When Krish overrules a decision, record it in the
commit body as `Ruling (Krish, YYYY-MM-DD): the ruling, in one line`. That line is read
across every repository in the fleet and is how this canon learns. A correction that
lives only in a chat window teaches nothing.

**Route.** principles, then context, then `strategy-brief`, then the producer, then
`verification-loop`, then the approval gate, then delivery. The narrowest applicable
skill wins; a broad "always" or "mandatory" claim inside a skill never overrides the
router. One primary writer; validators may stack after it, competing writers may not. **North Star:** before any work, read the North Star linked from the `north-star` block in `AGENTS.md` or `CLAUDE.md`, say which part of it the task moves, and say so first when it moves nothing; only Krish changes it, and a repository with none asks him for one. **Close out:** before a session that changed the repository ends, update `NOW.md` (status, the single next step, and one dated North Star check line: holds, or recalibration proposed for Krish). **One home per fact:** read a venture's state from its repository, doctrine from ai-harness; never keep a copy.

**Who Krish is.** Purpose: "I see what is coming before it is obvious and make it
legible to people while it still counts." Mindmake is his mission and his one company;
Heartside, Full Time, Legibility, CTRL and Pulse roll into it. One queue: the mission
leads, and product work is ordered beneath it by the live priority ladder. Profile,
decision rules and standing rulings: `skills/krish-principles/references/who-krish-is.md`
in the harness. What he works on is live, never copied here; read it from Control Center at
https://controlcenter.krishraja.com/api/canon/KRISH.md (and `PORTFOLIO.md` beside it).

**Where the rest lives.** The operating contract, the routing contract and the
29 curated skills are in `krishanraja/ai-harness`. On a machine with the
harness installed the same skills are under the user skills root, and the local copy is
authoritative for reading; the repository is authoritative for what is correct.

**This repository's own rules:** `AGENTS.md`, `README.md`
<!-- krish-canon:end -->

<!-- krish-repo-admin:start brain=b059141972f8 sha=0cc207a2c492 -->
## Administer this repository

Use `docs/HARNESS_CONTEXT.md` for the owning workflow, source of truth and checks. Preserve the goal and accepted decisions when a revision changes one part; explain material trade-offs. Verify the downstream result. Record corrections and observed outcomes through the existing capture path. Experimental results retain their conditions; inferred requirements remain proposals.
<!-- krish-repo-admin:end -->
