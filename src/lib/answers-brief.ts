import { ANSWER_MAX_WORDS, ANSWER_MIN_WORDS } from "./answers";

/**
 * The weekly answer-hub brief, as pure functions of the backlog and the published slugs.
 * scripts/answers-brief.ts reads the files and prints; .github/workflows/answers-weekly.yml
 * opens the issue. See docs/ANSWER-HUB.md.
 */

const PER_WEEK = 3;

export type Candidate = { slug: string; question: string; grounding: string };

/** Parse `- slug | question | grounding` lines under "## Candidates". */
export function parseBacklog(md: string): Candidate[] {
  const section = md.split(/^## Candidates\s*$/m)[1] ?? "";
  const out: Candidate[] = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^-\s+([a-z0-9-]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/);
    if (m) out.push({ slug: m[1], question: m[2], grounding: m[3] });
  }
  return out;
}

/** Monday of the ISO week containing `day` (YYYY-MM-DD), as YYYY-MM-DD. */
export function weekOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function briefTitle(day: string): string {
  return `Answer hub brief: week of ${weekOf(day)}`;
}

export function briefBody(day: string, backlog: Candidate[], published: string[]): string {
  const done = new Set(published);
  const next = backlog.filter((c) => !done.has(c.slug)).slice(0, PER_WEEK);
  const lines = [
    `Weekly answer hub brief for the week of ${weekOf(day)}. Generated from \`docs/answers-backlog.md\` with no model spend. The process and the quality bar are in \`docs/ANSWER-HUB.md\`.`,
    "",
    `Published so far: ${published.length}. Remaining in the backlog: ${backlog.filter((c) => !done.has(c.slug)).length}.`,
    "",
    "## Candidates this week",
    "",
  ];
  if (next.length === 0) {
    lines.push(
      "The backlog is empty. Add questions to `docs/answers-backlog.md`, sourced from support threads, MCP and API error reports, search queries, and what agents actually call.",
    );
  } else {
    for (const c of next) {
      lines.push(`- [ ] **${c.question}**`);
      lines.push(`  - slug: \`${c.slug}\``);
      lines.push(`  - grounding: ${c.grounding}`);
    }
  }
  lines.push(
    "",
    "## Checklist for each post",
    "",
    "- [ ] Every claim is checked against the grounding files. Nothing is invented: no prices, plans, limits or features that the code and docs do not state.",
    `- [ ] The first paragraph answers the question directly in ${ANSWER_MIN_WORDS} to ${ANSWER_MAX_WORDS} words.`,
    "- [ ] At least two `##` sections of depth, with a working code sample where one helps.",
    "- [ ] A `## FAQ` with at least two `###` questions, each ending in `?`.",
    "- [ ] `related:` links at least one existing post, and an existing post links back where it fits.",
    "- [ ] Honest dates: `published` is today; `updated` changes only when the content does.",
    "- [ ] The question and URL are added to the `## Answers` list in `public/llms.txt`.",
    "- [ ] `bun scripts/build-llms-full.ts` and `bun run build` are run so llms-full.txt and sitemap.xml include the post.",
    "- [ ] `bunx vitest run src/content/answers` and `bun scripts/check-geo.ts` pass.",
    "- [ ] Not linked from the header, footer or marketing pages.",
    "",
    "## Also this week",
    "",
    "- [ ] Re-read posts whose facts may have moved (pricing, x402 network, MCP tool list) and bump `updated` only where the text changed.",
    "- [ ] Move any question that came up in support or logs into the backlog.",
  );
  return lines.join("\n") + "\n";
}
