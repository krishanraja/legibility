import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { briefBody, briefTitle, parseBacklog, weekOf } from "./answers-brief";
import { answerFiles } from "./answers-fs";

const ROOT = resolve(__dirname, "../..");

describe("weekly brief", () => {
  it("dates the brief by the Monday of the week", () => {
    expect(weekOf("2026-10-21")).toBe("2026-10-19");
    expect(weekOf("2026-10-19")).toBe("2026-10-19");
    expect(weekOf("2026-10-25")).toBe("2026-10-19");
    expect(briefTitle("2026-10-26")).toBe("Answer hub brief: week of 2026-10-26");
  });

  it("parses only well-formed candidate lines under ## Candidates", () => {
    const md = [
      "- ignored-before | Not here? | x",
      "## Candidates",
      "",
      "- a-slug | Question A? | file.ts",
      "- bad line",
      "- b-slug | Question B? | other.md",
    ].join("\n");
    expect(parseBacklog(md)).toEqual([
      { slug: "a-slug", question: "Question A?", grounding: "file.ts" },
      { slug: "b-slug", question: "Question B?", grounding: "other.md" },
    ]);
    expect(parseBacklog("no section")).toEqual([]);
  });

  it("skips published slugs and caps the week at three", () => {
    const backlog = ["a", "b", "c", "d", "e"].map((s) => ({
      slug: s,
      question: `Q ${s}?`,
      grounding: "g",
    }));
    const body = briefBody("2026-10-21", backlog, ["a"]);
    expect(body).toContain("week of 2026-10-19");
    expect(body).toContain("Remaining in the backlog: 4.");
    expect(body).not.toContain("**Q a?**");
    expect(body).toContain("**Q b?**");
    expect(body).toContain("**Q d?**");
    expect(body).not.toContain("**Q e?**");
    expect(body).toContain("40 to 60 words");
  });

  it("says so when the backlog is empty", () => {
    expect(briefBody("2026-10-21", [], [])).toContain("The backlog is empty.");
  });

  it("the committed backlog is well formed and does not repeat published posts", () => {
    const backlog = parseBacklog(readFileSync(resolve(ROOT, "docs/answers-backlog.md"), "utf8"));
    expect(backlog.length).toBeGreaterThanOrEqual(PER_WEEK_MIN);
    const slugs = backlog.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const published = new Set(answerFiles(ROOT).map((f) => f.replace(/\.md$/, "")));
    for (const c of backlog) {
      expect(published.has(c.slug), `${c.slug} is already published`).toBe(false);
      expect(c.question.endsWith("?"), c.question).toBe(true);
    }
  });
});

const PER_WEEK_MIN = 3;
