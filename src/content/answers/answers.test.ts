import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ANSWERS, ANSWERS_BY_SLUG } from "./index";
import { answerFiles, loadAnswersFromDisk } from "@/lib/answers-fs";
import { answerUrl, buildRss, inlineToText, validateAnswers } from "@/lib/answers";

/**
 * The quality bar for the answer hub, enforced on every committed post.
 *
 * A post that breaks a rule fails CI with the rule named. The distribution checks below are
 * the "is it actually published" half: a post that exists as a page but is missing from the
 * sitemap, llms.txt, llms-full.txt or the feed is invisible to exactly the readers the hub
 * exists for. See docs/ANSWER-HUB.md for how to add a post.
 */

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
// Dates must not be in the future. Compared against the real date, so a post dated tomorrow
// fails today and passes tomorrow, which is the honest behaviour.
const TODAY = new Date().toISOString().slice(0, 10);

describe("answer hub content", () => {
  it("has seed posts", () => {
    expect(ANSWERS.length).toBeGreaterThanOrEqual(3);
  });

  it("every post meets the quality bar", () => {
    expect(validateAnswers(ANSWERS, TODAY)).toEqual([]);
  });

  it("the bundled posts and the files on disk are the same set", () => {
    const disk = loadAnswersFromDisk(ROOT);
    expect(ANSWERS.map((a) => a.slug).sort()).toEqual(disk.map((a) => a.slug).sort());
    expect(answerFiles(ROOT)).toHaveLength(ANSWERS.length);
    expect(Object.keys(ANSWERS_BY_SLUG)).toHaveLength(ANSWERS.length);
  });

  it("every post is in the sitemap with its updated date", () => {
    const sitemap = read("public/sitemap.xml");
    expect(sitemap).toContain("<loc>https://legibility.io/answers</loc>");
    for (const a of ANSWERS) {
      expect(sitemap, `${a.slug} missing from sitemap; run bun run build`).toContain(
        `<loc>${answerUrl(a.slug)}</loc><lastmod>${a.updated}</lastmod>`,
      );
    }
  });

  it("every post is listed in llms.txt with its question", () => {
    const llms = read("public/llms.txt");
    expect(llms).toContain("https://legibility.io/answers/feed.xml");
    for (const a of ANSWERS) {
      expect(llms, `${a.slug} missing from llms.txt`).toContain(`${a.title}: ${answerUrl(a.slug)}`);
    }
  });

  it("every post is in llms-full.txt in full", () => {
    const full = read("public/llms-full.txt");
    for (const a of ANSWERS) {
      expect(full, `${a.slug} missing; run bun scripts/build-llms-full.ts`).toContain(
        `URL: ${answerUrl(a.slug)}`,
      );
      expect(full).toContain(inlineToText(a.answer));
    }
  });

  it("every post is in the feed", () => {
    const rss = buildRss(ANSWERS);
    for (const a of ANSWERS) expect(rss).toContain(`<link>${answerUrl(a.slug)}</link>`);
  });

  it("the hub is not linked from the site chrome", () => {
    // Reachable and indexed, but not part of the primary navigation or marketing pages.
    for (const f of [
      "src/components/site/SiteHeader.tsx",
      "src/components/site/SiteFooter.tsx",
      "src/routes/index.tsx",
    ]) {
      expect(read(f), f).not.toMatch(/["'`]\/answers/);
    }
  });
});
