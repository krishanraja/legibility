import { describe, expect, it } from "vitest";
import {
  answerToText,
  buildRss,
  inlineToText,
  parseAnswer,
  parseBlocks,
  parseFrontmatter,
  rfc822,
  sortAnswers,
  tokenizeInline,
  validateAnswers,
  wordCount,
  type Answer,
} from "./answers";

const EM = String.fromCharCode(0x2014);
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

function post(slug: string, over: Partial<Record<string, string>> = {}, body?: string): string {
  const fm = {
    title: '"Is this a question?"',
    description: '"A description that is long enough to pass the fifty character rule."',
    published: '"2026-10-01"',
    updated: '"2026-10-02"',
    tags: "[a, b]",
    related: "[]",
    ...over,
  };
  return [
    "---",
    ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body ??
      [
        words(45),
        "",
        "## One",
        "",
        "Text with `code`, **bold** and a [link](/docs).",
        "",
        "## Two",
        "",
        "- item one",
        "  continued",
        "- item two",
        "",
        "## FAQ",
        "",
        "### First?",
        "",
        "Yes.",
        "",
        "### Second?",
        "",
        "No.",
        "",
        "More no.",
      ].join("\n"),
  ].join("\n");
}

describe("parseFrontmatter", () => {
  it("returns the whole text as body without frontmatter", () => {
    expect(parseFrontmatter("hello")).toEqual({ data: {}, body: "hello" });
  });
  it("returns the text unchanged when the block is unterminated", () => {
    expect(parseFrontmatter("---\ntitle: x\n")).toEqual({ data: {}, body: "---\ntitle: x\n" });
  });
  it("reads flat pairs, wrapped flow lists and block lists", () => {
    const { data, body } = parseFrontmatter(
      [
        "---",
        "title: x",
        "noise line",
        ": empty key",
        "related:",
        "  [",
        "    a,",
        "    b,",
        "  ]",
        "tags:",
        "  - c",
        "  - d",
        "---",
        "",
        "body",
      ].join("\r\n"),
    );
    expect(data.title).toBe("x");
    expect(data.related).toBe("[ a, b, ]");
    expect(data.tags).toBe("c, d,");
    expect(body).toBe("body");
  });
});

describe("parseBlocks", () => {
  it("parses headings, code, lists and paragraphs", () => {
    const blocks = parseBlocks(
      [
        "para one",
        "continues",
        "## Head `x`",
        "### Sub",
        "```bash",
        "echo hi",
        "",
        "echo there",
        "```",
        "```",
        "plain",
        "```",
        "1. first",
        "2. second",
        "- bullet",
        "after list",
        "",
        "lead in",
        "- tail",
      ].join("\n"),
    );
    expect(blocks).toEqual([
      { type: "p", text: "para one continues" },
      { type: "h2", text: "Head `x`", id: "head-x" },
      { type: "h3", text: "Sub", id: "sub" },
      { type: "code", lang: "bash", code: "echo hi\n\necho there" },
      { type: "code", lang: "text", code: "plain" },
      { type: "ol", items: ["first", "second"] },
      { type: "ul", items: ["bullet"] },
      { type: "p", text: "after list" },
      { type: "p", text: "lead in" },
      { type: "ul", items: ["tail"] },
    ]);
  });
});

describe("inline", () => {
  it("tokenises code, bold and links and keeps the rest as text", () => {
    expect(tokenizeInline("a `b` **c** [d](/e) f")).toEqual([
      { kind: "text", text: "a " },
      { kind: "code", text: "b" },
      { kind: "text", text: " " },
      { kind: "strong", text: "c" },
      { kind: "text", text: " " },
      { kind: "link", text: "d", href: "/e" },
      { kind: "text", text: " f" },
    ]);
    expect(inlineToText("see [the docs](/docs)")).toBe("see the docs");
    expect(wordCount("")).toBe(0);
    expect(wordCount("one `two` three")).toBe(3);
  });
});

describe("parseAnswer", () => {
  it("splits the direct answer, the body and the FAQ", () => {
    const a = parseAnswer("./dir/my-post.md", post("my-post"));
    expect(a.slug).toBe("my-post");
    expect(a.title).toBe("Is this a question?");
    expect(a.tags).toEqual(["a", "b"]);
    expect(a.related).toEqual([]);
    expect(wordCount(a.answer)).toBe(45);
    expect(a.body.filter((b) => b.type === "h2")).toHaveLength(2);
    expect(a.faq).toEqual([
      { q: "First?", a: "Yes." },
      { q: "Second?", a: "No. More no." },
    ]);
  });
  it("tolerates a file with no frontmatter, no answer and no FAQ", () => {
    const a = parseAnswer("bare.md", "## Only a heading\n\ntext");
    expect(a.title).toBe("");
    expect(a.answer).toBe("");
    expect(a.updated).toBe("");
    expect(a.faq).toEqual([]);
    expect(a.body[0]).toMatchObject({ type: "h2" });
    expect(parseAnswer("e.md", "").answer).toBe("");
  });
  it("defaults updated to published and ignores FAQ text before the first question", () => {
    const a = parseAnswer(
      "x.md",
      post("x", { updated: '""' }, `${words(45)}\n\n## FAQ\n\nstray\n\n### Q?\n\nA.`).replace(
        'updated: ""\n',
        "",
      ),
    );
    expect(a.updated).toBe("2026-10-01");
    expect(a.faq).toEqual([{ q: "Q?", a: "A." }]);
  });
});

describe("validateAnswers", () => {
  const good = (slug: string, related = "[]") =>
    parseAnswer(`${slug}.md`, post(slug, { title: `"Question ${slug}?"`, related }));

  it("accepts valid posts", () => {
    expect(
      validateAnswers([good("a-post", "[b-post]"), good("b-post", "[a-post]")], "2026-10-21"),
    ).toEqual([]);
  });

  it("reports every rule that a bad post breaks", () => {
    const bad: Answer = {
      ...good("Bad_Slug"),
      title: "Not a question",
      description: "short",
      published: "2026-13-40",
      updated: "2026-02-30",
      tags: [],
      answer: "too short",
      body: [{ type: "p", text: `an em ${EM} dash and [bad](ftp://x) and [ok](https://x.org)` }],
      faq: [{ q: "No mark", a: "" }],
      related: ["Bad_Slug", "missing"],
    };
    const errors = validateAnswers([bad, { ...bad }], "2026-10-21");
    const text = errors.join("\n");
    for (const needle of [
      "slug must be lowercase",
      "duplicate slug",
      "title must be the question",
      "duplicate title",
      "description must be 50 to 170",
      "published must be a real",
      "updated must be a real",
      "needs at least one tag",
      "must be 40 to 60 words",
      "at least two ## sections",
      "needs a ## FAQ section",
      "does not end in '?'",
      "has no answer",
      "related lists itself",
      "related slug does not exist: missing",
      "contains an em dash",
      "link must be a site path or https URL: ftp://x",
    ]) {
      expect(text).toContain(needle);
    }
    expect(text).not.toContain("https://x.org");
  });

  it("rejects future dates, an update before publication and missing titles and links", () => {
    const future = { ...good("c-post"), published: "2026-11-01", updated: "2026-10-30" };
    const untitled = { ...good("d-post"), title: "" };
    const errors = validateAnswers([future, untitled], "2026-10-21").join("\n");
    expect(errors).toContain("updated is earlier than published");
    expect(errors).toContain("later than today");
    expect(errors).toContain("d-post: missing title");
    expect(errors).toContain("needs at least one related slug");
  });

  it("checks list and code blocks for em dashes", () => {
    const a = {
      ...good("e-post"),
      body: [
        { type: "ul" as const, items: [`x ${EM} y`] },
        { type: "code" as const, lang: "text", code: "z" },
      ],
    };
    expect(validateAnswers([a], "2026-10-21").join("\n")).toContain("em dash");
  });
});

describe("feed and text output", () => {
  const a = parseAnswer("a-post.md", post("a-post", { title: '"Fish & <chips>?"' }));
  const b = parseAnswer("b-post.md", post("b-post", { updated: '"2026-10-05"' }));

  it("sorts newest first with a stable tie-break", () => {
    const c = { ...a, slug: "c-post" };
    expect(sortAnswers([a, b, c]).map((x) => x.slug)).toEqual(["b-post", "a-post", "c-post"]);
    const older = { ...a, slug: "d-post", published: "2026-09-01" };
    expect(sortAnswers([older, a]).map((x) => x.slug)).toEqual(["a-post", "d-post"]);
  });

  it("builds an escaped, deterministic RSS feed", () => {
    const xml = buildRss([a, b]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<title>Fish &amp; &lt;chips&gt;?</title>");
    expect(xml).toContain('<guid isPermaLink="true">https://legibility.io/answers/b-post</guid>');
    expect(xml).toContain(`<lastBuildDate>${rfc822("2026-10-05")}</lastBuildDate>`);
    expect(xml.indexOf("b-post")).toBeLessThan(xml.indexOf("a-post"));
    expect(xml).toContain("<category>a</category>");
    expect(buildRss([a, b])).toBe(xml);
    expect(buildRss([])).not.toContain("lastBuildDate");
    expect(rfc822("2026-10-21")).toBe("Wed, 21 Oct 2026 00:00:00 GMT");
    expect(buildRss([{ ...a, title: `"quoted" 'single'` }])).toContain(
      "&quot;quoted&quot; &apos;single&apos;",
    );
  });

  it("renders every block kind as plain text", () => {
    const withAll: Answer = {
      ...a,
      body: [
        { type: "h2", text: "H", id: "h" },
        { type: "h3", text: "S", id: "s" },
        { type: "p", text: "P [l](/x)" },
        { type: "code", lang: "bash", code: "echo" },
        { type: "ul", items: ["u"] },
        { type: "ol", items: ["o"] },
      ],
      faq: [{ q: "Q?", a: "A." }],
    };
    const text = answerToText(withAll);
    expect(text).toContain("URL: https://legibility.io/answers/a-post");
    expect(text).toContain("#### H");
    expect(text).toContain("S:");
    expect(text).toContain("P l");
    expect(text).toContain("```bash\necho\n```");
    expect(text).toContain("- u");
    expect(text).toContain("1. o");
    expect(text).toContain("- Q: Q? A: A.");
    expect(answerToText({ ...withAll, faq: [] })).not.toContain("FAQ:");
  });
});
