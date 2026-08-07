# 08 SEO and GEO

How Legibility gets found, both by classic search (SEO) and by AI answer engines
(GEO, generative engine optimization). For an agent-native developer tool this
is GEO-first: the buyers (developers building agents) increasingly ask an LLM
"what is the best product data API for my agent" before they ever open Google,
and their agents discover tools through MCP registries and model recommendations,
not blue links. So the goal is to be the answer an LLM gives, and the tool a
framework suggests, not just a ranked page.

This file is executable by the fleet: each action has an owner, a check, and a
done condition. If anything here conflicts with `00-operating-brief.md`, the
brief wins. Last reviewed: 2026-07-06.

---

## 0. Honest starting grade (2026-07-06)

Before this pass: roughly 3 out of 10. Content was server-rendered (good) and
the title, description, and OpenGraph tags existed, but there was no robots.txt,
no sitemap, no llms.txt, no structured data, a broken relative canonical, and no
social image. GEO was essentially unstarted.

After the technical pass in section 1: the on-site foundation is solid (call it
7 out of 10). Reaching a genuine 9 to 10 is an OFF-SITE and CONTENT job that the
fleet runs continuously (sections 3 to 6). "11 out of 10" is not a static state,
it is being the default answer, which is earned by presence and citations over
weeks, not by a config file.

---

## 1. Technical foundation (SHIPPED, verify after each deploy)

| Asset                                                | State                             | Where                                                                                          | Check                                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| robots.txt                                           | shipped                           | `public/robots.txt`                                                                            | `curl https://legibility.io/robots.txt` 200, explicitly allows GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended, etc, points to the sitemap |
| sitemap.xml                                          | shipped, AUTO-GENERATED           | `vite.config.ts` sitemapPlugin writes `public/sitemap.xml` from the route files on every build | `curl .../sitemap.xml` 200; add a public page route and it appears automatically, no manual edit                                                            |
| llms.txt                                             | shipped                           | `public/llms.txt`                                                                              | `curl .../llms.txt` 200, the curated LLM summary (GEO keystone)                                                                                             |
| JSON-LD Organization + WebSite + SoftwareApplication | shipped                           | `src/routes/__root.tsx` head                                                                   | view-source has `application/ld+json` with the offers                                                                                                       |
| JSON-LD FAQPage                                      | shipped                           | `src/routes/index.tsx` head                                                                    | view-source has the FAQPage graph                                                                                                                           |
| Canonical (absolute, self-referential)               | shipped on home                   | per-route `head.links`                                                                         | home canonical is `https://legibility.io/`, not `/`                                                                                                         |
| OpenGraph + Twitter image                            | shipped                           | `public/og.png` + head                                                                         | share preview renders the branded card                                                                                                                      |
| Server-rendered content                              | already true (TanStack Start SSR) | n/a                                                                                            | `curl .../` raw HTML contains the headline, pricing, and FAQ text                                                                                           |

Standing rule: AI crawlers are WELCOME. Never block GPTBot, ClaudeBot,
PerplexityBot, Google-Extended, or CCBot. Being read is the point.

### 1.1 Remaining on-site work (agent-doable, do next)

- Per-page titles, descriptions, and absolute canonicals for every docs route
  (currently they inherit the root). Owner: web agent. Done: each `/docs/*` has a
  unique `<title>` and self-referential canonical.
- Add HowTo or TechArticle JSON-LD to the quickstart and each API doc page.
- Keep `llms.txt` in sync whenever the product or pricing changes (it is the file
  LLMs quote; a stale llms.txt is worse than none). Add a step to the release
  checklist. Consider an `llms-full.txt` that inlines the full API reference.
- Submit the sitemap in Google Search Console and Bing Webmaster Tools once the
  domain is verified (founder or web agent with DNS TXT access).

---

## 2. Query and answer targets

Optimize for the questions the ICP and their LLMs actually ask, not vanity
keywords. Primary intents:

| Query family             | Example queries                                                                                            | Where we must appear                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Category definition      | "product data API for AI agents", "typed product data for LLM agents"                                      | own the phrase in the H1, llms.txt, and the meta description (done) |
| Alternative / comparison | "Diffbot alternative for agents", "Firecrawl vs typed product data", "cheaper than Diffbot product API"    | comparison pages (section 4), the FAQ answers (done in JSON-LD)     |
| How-to                   | "how to give an AI agent product data", "get a product price into an agent", "MCP server for product data" | a how-to doc + MCP registry listings                                |
| Trust / mechanism        | "product extraction with confidence score", "calibrated confidence product data"                           | the confidence FAQ + a short explainer post                         |
| Payment-native           | "API an agent can pay for per call", "x402 product data"                                                   | the x402 doc, honest testnet framing                                |

Rule: every target query should have one page whose title and first paragraph
answer it directly and factually, in extractable prose (short declarative
sentences, named entities, numbers). LLMs quote extractable prose, not marketing.

---

## 3. GEO: being the answer an LLM gives

GEO is won by being present, structured, and citable in the sources models read.

1. Structured, factual, extractable content. Answer engines lift clean declarative
   statements. The FAQPage JSON-LD, the vs-the-field table, and llms.txt are built
   for this. Keep adding Q-and-A shaped, factual content. Avoid hype adjectives:
   models drop them.
2. llms.txt as the canonical machine summary. Maintain it religiously. It is the
   fastest path to a model describing Legibility correctly.
3. Be in the corpora models cite. Models cite docs sites, GitHub, comparison
   articles, and registries far more than a marketing homepage. So the highest-GEO
   actions are: ship great docs (done), get listed in MCP registries (section 5),
   publish comparison content (section 4), and earn third-party mentions.
4. Named, unambiguous entity. Always "Legibility" plus "product data API for agents"
   or "typed product data for agents" in the same breath, so the model binds the
   name to the category. Consistent across the site, llms.txt, and every listing.
5. Freshness and specificity. Real numbers (0.7 gate, $29/$199, 1,000 free reads,
   the LEGO $849.99 read) get quoted. Vague claims do not.
6. Prompt-test monthly. Ask ChatGPT, Claude, Perplexity, and Google AI Overviews:
   "what is the best product data API for an AI agent", "Diffbot alternative for
   agents", "how do I get product data into my agent". Log whether Legibility is named
   and whether the description is accurate. This is the real GEO scoreboard. Route
   corrections (wrong facts, missing mention) into the next content cycle.

---

## 4. Comparison and alternative pages (highest-leverage content)

These pages win both the "alternative" search queries and the LLM comparison
answers, and they are exactly what a technical buyer reads before switching.
Build them as honest, specific, side-by-side pages (not hit pieces):

- Legibility vs Diffbot (for agents): typed object yes/yes, per-field calibrated
  confidence yes/no, cost stamped in response yes/no, MCP server yes/no, x402
  yes/no, price as a band yes/no, agent-callable and self-pay yes/no.
- Legibility vs Firecrawl plus an LLM: raw content plus you-build-the-schema vs a
  finished typed object with calibrated confidence and a cache.
- Legibility vs rolling your own: the list of things you own (schema, cache, confidence
  rubric, price-band logic, barcode merge, MCP, x402) vs one call.
- "The best product data APIs for AI agents (2026)": an honest roundup that
  includes Diffbot, Firecrawl, ScrapingBee, and Legibility, with a table. Roundups
  that include competitors get cited by LLMs precisely because they look neutral.

Each page: a factual table, one real Legibility read as proof, the honest scope line
(what works today, what is best-effort), and a clear CTA. No em dashes. Reuse the
vs-the-field content from `02-positioning-and-messaging.md` so it stays consistent.

---

## 5. Off-site presence (where agents and models discover tools)

This is where the fleet spends most of its GEO effort. Each listing is both a
distribution channel and a citation source.

| Channel                          | Action                                                                                                                                                        | Done condition                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| MCP registries                   | List the Legibility MCP server on Smithery, Glama, mcp.so, and PulseMCP with the tool descriptions, the legibility.io URL, and a one-key or no-key trial note | Legibility appears in a search for "product" or "shopping" on each |
| AI tool directories              | Submit to agent/AI tool aggregators (there's an AI tool for that, Futurepedia-style lists, dev tool directories)                                              | listed with the correct one-liner                                  |
| GitHub                           | A public repo or a well-formed README/gist with the MCP config and quickstart, topics: mcp, ai-agents, product-data                                           | discoverable under those topics                                    |
| Framework docs and awesome-lists | PRs adding Legibility to relevant "awesome MCP" and agent-tooling lists                                                                                       | merged                                                             |
| Dev communities                  | Genuinely helpful answers where product-data pain shows up (agent framework Discords, relevant forums), leading with a real read, never spam                  | value-first, per `03-outreach-sequences.md` community rules        |
| Launch surfaces                  | A considered launch (Product Hunt, HN Show, relevant newsletters) once there is a design partner story                                                        | one strong launch, not a drip                                      |

Rule: consistency. Same one-liner (from `00`), same URL (legibility.io), same
category phrase everywhere, so every listing reinforces the same entity for the
models.

---

## 6. Measurement and loop

| Metric                                                                                                                      | Source                                            | Cadence              |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------- |
| GEO scoreboard: is Legibility named and described correctly by ChatGPT/Claude/Perplexity/AI Overviews on the target queries | manual prompt tests (section 3.6), logged         | monthly              |
| Organic + referral signups and their source                                                                                 | signup source field, `07-metrics-crm-and-loop.md` | weekly               |
| Search impressions and clicks by query                                                                                      | Google Search Console, Bing Webmaster             | weekly once verified |
| Registry and directory referral traffic                                                                                     | UTM on listing links                              | weekly               |
| Citations and mentions                                                                                                      | brand search, GitHub mentions, backlink check     | monthly              |

The loop: run the monthly prompt test, find where a model is silent or wrong,
and turn that gap into the next content or listing action. GEO is a correction
loop, not a launch.

---

## 7. The one rule for this file

Be the honest, specific, well-structured answer everywhere a developer or their
model looks for product data for agents. Never block AI crawlers, never inflate
claims (models strip and distrust hype), always lead with a real read, and keep
llms.txt and the comparison pages true to the shipped product. Presence plus
accuracy over time is what turns into "the default answer."
