# Answer hub

Status: Current
Owner: Krish Raja
Last verified: 2026-10-21

The answer hub is a shelf of direct answers to questions developers and agents ask, at
`https://legibility.io/answers`. It exists for the North Star: an agent, or the developer
building one, should be able to ask an assistant how to pay per call, how to reach an MCP
server, or how to read typed product data, and be pointed at Legibility with a correct answer.

## What it is, and what it is not

- **Public and identical for everyone.** Every post is a server-rendered page at a stable URL,
  `/answers/<slug>`. Humans and crawlers get the same HTML. There is no cloaking, no hidden
  text and no user-agent detection anywhere in it.
- **Not in the site chrome.** The hub is not linked from the header, the footer or the
  marketing pages, and `src/content/answers/answers.test.ts` fails if it is. People and agents
  reach it from search, from assistants, and from the machine-readable surfaces below.
- **Listed everywhere a machine looks:** `public/sitemap.xml` (generated at build, with each
  post's `updated` date as `lastmod`), `public/llms.txt` (the `## Answers` list),
  `public/llms-full.txt` (full text, generated), the RSS feed at `/answers/feed.xml`, and the
  `/answers` index.
- **Structured.** Each post carries `Article`, `FAQPage` and `BreadcrumbList` JSON-LD, a
  canonical URL, Open Graph article tags and the answers social card. The publisher and author
  are the Legibility organisation.

## Cadence

Weekly. Every Monday at 07:23 UTC, `.github/workflows/answers-weekly.yml` opens one issue,
`Answer hub brief: week of <Monday>`, with the next three unpublished candidates from
`docs/answers-backlog.md` and the checklist below. It spends no model credits and calls no
service other than GitHub issues. It can also be run by hand from the Actions tab; a second run
in the same week does not open a duplicate.

Aim for one to three posts a week. A week with none is better than a week with a weak one.

## Sourcing questions

A question earns a place in the backlog when someone actually asks it. Good sources:

- Support email and takedown threads.
- API and MCP errors in `usage_events`: the calls that fail tell you what people misunderstand.
- Questions asked of assistants about agent payments, MCP and product data.
- Search queries that reach the docs.

Write the question exactly as a person would type it, and record where the facts live. A
candidate whose answer is not grounded in this repository does not go in the backlog.

## The quality bar

Enforced by `validateAnswers` in `src/lib/answers.ts`, run by
`src/content/answers/answers.test.ts` and by `bun scripts/check-geo.ts`:

- The title is the question and ends in `?`. The slug is the filename, lowercase and hyphenated.
- `description` is 50 to 170 characters.
- **The first paragraph is the direct answer, 40 to 60 words.** It is what answer engines quote.
- At least two `##` sections of depth after it, and a `## FAQ` with at least two `###`
  questions, each answered.
- `related:` names at least one existing post, so posts cross-link.
- Honest dates: `published` and `updated` are real dates, not in the future, and `updated` is not
  earlier than `published`. Change `updated` only when the content changes.
- Links are site paths (`/docs/mcp`) or `https://` URLs. No em dashes (house style).
- Present in the sitemap, `llms.txt`, `llms-full.txt` and the feed.

And the rule no test can check: **every claim is true of the product today.** Check it against
the code and `docs-internal/api.md`, not against marketing copy or memory. Never invent a price,
a plan, a limit or a feature. Say what is not built yet (for example, x402 runs on Base Sepolia
and has no mainnet settlement). Where the public docs disagree with the code, the code wins, and
the disagreement is a bug to report rather than a fact to repeat.

## How to add a post

1. Pick a candidate from the week's issue or from `docs/answers-backlog.md`.
2. Create `src/content/answers/<slug>.md`:

   ```markdown
   ---
   title: "How does an agent do the thing?"
   description: "One sentence, 50 to 170 characters, saying what the page answers."
   published: "2026-10-21"
   updated: "2026-10-21"
   tags: [MCP, x402]
   related: [how-can-an-ai-agent-pay-per-api-call-in-usdc]
   ---

   The direct answer in 40 to 60 words.

   ## A section of depth

   Text, `inline code`, **bold** and [links](/docs/mcp). Fenced code blocks and lists work.

   ## Another section

   ## FAQ

   ### A follow-up question?

   Its answer.
   ```

   The Markdown subset is: paragraphs, `##` and `###` headings, fenced code, `-` and `1.`
   lists, inline code, bold and links. Nothing else is rendered, and raw HTML is shown as text.

3. Add the question and URL to the `## Answers` list in `public/llms.txt`, in the form
   `- <title>: https://legibility.io/answers/<slug>`.
4. Remove the candidate from `docs/answers-backlog.md`.
5. Regenerate the derived files: `bun scripts/build-llms-full.ts`, then `bun run build` (which
   rewrites `public/sitemap.xml`).
6. Run `bunx prettier --write src/content/answers`, `bunx vitest run src/content/answers` and
   `bun scripts/check-geo.ts`, then the full CI gate sequence in `AGENTS.md`.

The page, the feed item and the structured data need no further work: they are derived from the
file.

## Where things live

| Thing                  | Path                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| Posts                  | `src/content/answers/*.md`                                            |
| Parser, rules, feed    | `src/lib/answers.ts`                                                  |
| Pages                  | `src/routes/answers.index.tsx`, `src/routes/answers.$slug.tsx`        |
| Feed                   | `src/routes/answers.feed[.]xml.ts`                                    |
| Sitemap entries        | `sitemapPlugin` in `vite.config.ts`                                   |
| llms-full.txt sections | `scripts/build-llms-full.ts`                                          |
| Weekly brief           | `scripts/answers-brief.ts`, `.github/workflows/answers-weekly.yml`    |
| Backlog                | `docs/answers-backlog.md`                                             |
| Social card            | `public/og-answers.png`, generated by `scripts/build-brand-assets.ts` |
