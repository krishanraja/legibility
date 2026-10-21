import { parseAnswer, sortAnswers, type Answer } from "@/lib/answers";

/**
 * Every answer post, parsed once at module load.
 *
 * import.meta.glob is resolved at build time, so adding a .md file to this directory is all it
 * takes to publish a post: it is bundled, server-rendered at /answers/<slug>, and picked up by
 * the sitemap, the feed and llms-full.txt. The rules a post must meet are in
 * src/lib/answers.ts (validateAnswers) and are enforced by src/content/answers/answers.test.ts.
 */
const files = import.meta.glob("./*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const ANSWERS: Answer[] = sortAnswers(
  Object.entries(files).map(([file, raw]) => parseAnswer(file, raw)),
);

export const ANSWERS_BY_SLUG: Record<string, Answer> = Object.fromEntries(
  ANSWERS.map((a) => [a.slug, a]),
);
