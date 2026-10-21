# Answer hub backlog

Status: Current
Owner: Krish Raja
Last verified: 2026-10-21

Candidate questions for the answer hub at `/answers`. The weekly workflow
(`.github/workflows/answers-weekly.yml`) reads this file, skips any slug that is already
published in `src/content/answers/`, and puts the next three into the week's brief issue.

How to read a line: `- slug | the question, exactly as someone would ask it | where the facts live`.
The third field is the grounding: every claim in the eventual post must be checkable against
it. A candidate with no grounding in this repository does not belong here.

Order is priority. Put the question closest to the North Star (agents paying per call) first.

## Candidates

- what-is-a-trusted-read-and-when-is-an-api-call-billed | What is a trusted read, and when is an API call billed? | docs-internal/api.md (Billing and metering), src/lib/api/meter.ts
- how-do-agents-discover-an-mcp-servers-tools-before-paying | How does an agent discover an MCP server's tools before it pays? | public/.well-known/mcp.json, src/routes/api/mcp.ts
- how-can-an-agent-look-up-a-product-by-barcode | How can an agent look up a product by its barcode (GTIN, UPC or EAN)? | src/config/product.ts (DEMO_GTIN), docs-internal/api.md (Coverage)
- how-can-an-agent-turn-a-product-name-into-a-specific-product | How can an agent turn a fuzzy product name into a specific product? | src/routes/api/v1/resolve_product.ts, src/routes/docs.api.resolve-product.tsx
- why-return-a-price-band-instead-of-a-price | Why does a product API return a price band instead of a single price? | docs-internal/api.md (Why these decisions)
- how-can-an-agent-compare-prices-across-product-pages | How can an agent compare prices across several product pages? | src/routes/api/v1/compare_products.ts, docs-internal/api.md
- how-do-i-allow-ai-crawlers-in-robots-txt | How do I allow or block AI crawlers in robots.txt? | public/robots.txt, scripts/check-geo.ts (grouping rule)
- how-do-i-make-product-pages-readable-by-ai-agents | How do I make my product pages readable by AI agents? | src/content/reasons.ts, src/lib/api/readability.ts (REASON_FIX)
- why-does-a-javascript-site-look-empty-to-ai-crawlers | Why does my site look empty to AI crawlers when it renders in JavaScript? | src/content/reasons.ts (js_shell)
- how-can-an-agent-report-whether-a-product-answer-was-right | How can an agent report whether a product answer turned out to be right? | docs-internal/api.md (report_outcome)
