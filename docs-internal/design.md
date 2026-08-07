# Design

## Direction: Editorial Warm

Print-press warmth, typographic confidence, no SaaS gloss. Generous
whitespace, rules and hairlines instead of cards-with-shadows. Mono used as
accent, not as the dominant voice.

## Colour tokens

Defined as `oklch` in `src/styles.css`. Use the token, never a hex.

| Token                | Role                                 |
| -------------------- | ------------------------------------ |
| `--background`       | Cream page background                |
| `--surface`          | Slightly raised panel                |
| `--foreground`       | Deep navy text                       |
| `--muted-foreground` | Secondary text                       |
| `--signal`           | Terracotta accent (CTAs, highlights) |
| `--verified`         | Cool green (rare; payment states)    |
| `--hairline`         | Border colour                        |
| `--stone`            | Italic editorial text                |

Never hardcode `text-white`, `bg-black`, or bracket hex utilities.

## Typography

- **Display:** Instrument Serif (regular + italic). Use for H1/H2 and any
  feature number.
- **Body:** Inter 400/500/600/700.
- **Mono:** JetBrains Mono for code, labels, section markers (`§02`), and
  small uppercase chrome.

Apply `text-balance` to every H1 and H2. Multi-line marketing text should
breathe; never use hardcoded `<br/>`.

## Logo

Two bundled PNG assets, imported directly in the header and footer (these
are real image imports, not CDN `.asset.json` files):

- `src/assets/legibility-wordmark.png`: the wordmark (header + footer).
- `src/assets/legibility-icon-and-favicon.png`: the square mark (header lockup).

Favicon and apple-touch icon are served from `public/` (`/favicon.png`,
`/apple-touch-icon.png`) and wired in `src/routes/__root.tsx`.

Header lockup: icon + wordmark, both at `h-14`, with "product data for
agents" as a muted tagline on `sm` and larger screens. Footer: wordmark
alone at `h-6`. Never recolour the logo in CSS; if a new tint is needed,
upload a new asset. A 1200x630 OG social card is not wired yet (roadmap):
`head()` sets og:title and og:description but no og:image.

## Shipped surfaces

The public site and the app are live. Match these when you touch them.

### The hero is a real captured call

The landing hero streams a real product response, captured verbatim from the
live extraction worker into `src/data/hero-capture.json`. Never hand-write
response values in `index.tsx`: import them from the capture so the hero can
never drift from what the API actually returns. The response panel footer
reads "A real response, captured from the live API. URL reads are in private
beta." The demo input is a real GTIN (from `src/config/product.ts`) that
returns a trusted object today. If you swap the demo, re-capture it. Do not
fabricate a richer object than the engine actually produces. That was the
original sin the audit caught, and it stays fixed.

### Mobile front door

`src/components/site/SiteHeader.tsx` has a working mobile nav: a hamburger
toggles the same docs / pricing / mcp / sign-in links that show on desktop,
so sign-in is reachable on a phone. Do not ship a header that drops these on
mobile.

### Dashboard

`/dashboard` (`dashboard.tsx`) is a left-nav shell over six tabs: Overview,
API keys, Usage, Billing, Webhooks, Metrics. The active tab is marked with
`bg-surface text-signal`. Every copy-pasteable curl in the dashboard and
docs comes from `demoCurl()` in `src/config/product.ts` and must succeed
verbatim once a real key is substituted. Never point a sample at a domain
that does not resolve.

### Metrics (admin only)

`/dashboard/metrics` is the North Star surface, gated to Legibility admins. It
shows trusted-reads-per-account, the moat metric (golden precision at gate,
with its Wilson lower bound and calibration version), gate-pass rate by
method (labelled clearly as gate-pass, NOT correctness), and the kill
dashboard. It reads near zero until real accounts make repeat trusted calls,
and the page says so. Keep that honesty: do not dress a zero up as traction.

## Voice

- Plain, editorial, declarative. Short sentences. Prefer a period over an em
  dash.
- Never use the em dash. Use a period, a comma, parentheses, or a middle dot
  (·). This rule is mechanical: CI greps for the character across `src/`,
  `docs/`, `docs-internal/`, `public/` and the README, and fails the build on a
  hit. (The character is not written out here, so that this file passes its own
  rule.)
- Title separator is the middle dot (·), for example "Legibility · Product data
  for agents".
- Honest before clever. "Price is a band" beats "real-time pricing". Every
  sample and every hero value must be reproducible against the live API.

### On-brand vs off-brand

| Off-brand                                     | On-brand                                               |
| --------------------------------------------- | ------------------------------------------------------ |
| "AI-powered next-gen product intelligence."   | "Typed product object, confidence per field."          |
| "Real-time pricing across the entire web."    | "Price as a band, with as_of and n_sources."           |
| "Unleash your agents with our seamless API!"  | "Agents can discover the MCP server and pay per call." |
| "Trusted by leading enterprises."             | (omit; use a real customer logo or nothing)            |
| A hero object richer than the engine returns. | The exact captured call, private-beta caveat and all.  |

---

Last reviewed: 2026-07-06.
