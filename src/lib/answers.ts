import { APP_ORIGIN } from "../config/product";

/**
 * The answer hub: one Markdown file per question in src/content/answers/.
 *
 * Each file is a real question a developer or an agent asks, answered directly in the first
 * paragraph and then in depth. Adding a post is adding a file; the page, the sitemap entry,
 * the feed item, the llms-full.txt section and the structured data are all derived from it.
 *
 * The Markdown is a deliberately small subset (paragraphs, ##/### headings, fenced code,
 * bullet and numbered lists, and inline code, links and bold). It is parsed here into
 * blocks and rendered as React elements, never as raw HTML, so a post cannot inject markup.
 * The same parse feeds the server-rendered page, the RSS feed and llms-full.txt, so the
 * three cannot disagree about what a post says.
 *
 * Everything in this module is a pure function of the file text. Reading the files is done by
 * the caller: import.meta.glob in the app, node:fs in scripts and the build.
 */

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string; id: string }
  | { type: "code"; lang: string; code: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export type Faq = { q: string; a: string };

export type Answer = {
  slug: string;
  title: string;
  description: string;
  published: string;
  updated: string;
  tags: string[];
  related: string[];
  /** The direct answer: the first paragraph of the body, inline Markdown. */
  answer: string;
  /** Everything after the direct answer, up to the FAQ. */
  body: Block[];
  faq: Faq[];
};

/** Bounds for the direct answer, in words. Answer engines quote the first 40 to 60 words. */
export const ANSWER_MIN_WORDS = 40;
export const ANSWER_MAX_WORDS = 60;

export const ANSWERS_PATH = "/answers";
export const ANSWERS_FEED_PATH = "/answers/feed.xml";

export const answerUrl = (slug: string) => `${APP_ORIGIN}${ANSWERS_PATH}/${slug}`;

/* ------------------------------------------------------------------ parsing */

export function slugFromFilename(file: string): string {
  const base = file.split("/").pop() ?? file;
  return base.replace(/\.md$/, "");
}

export function headingId(text: string): string {
  return inlineToText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseList(v: string): string[] {
  const t = v.trim();
  const inner = t.startsWith("[") && t.endsWith("]") ? t.slice(1, -1) : t;
  return inner
    .split(",")
    .map((s) => unquote(s))
    .filter((s) => s.length > 0);
}

/** Split `---` frontmatter from the body. Flat `key: value` pairs only. */
export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 4);
  if (end === -1) return { data: {}, body: text };
  const data: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const line of text.slice(4, end).split("\n")) {
    // Continuation of the previous key: a flow list Prettier wrapped over several lines
    // ("related:\n  [\n    a,\n    b,\n  ]") or a block list ("tags:\n  - a\n  - b").
    if (lastKey && /^\s+\S/.test(line)) {
      const t = line.trim();
      const item = t.startsWith("- ") ? `${t.slice(2).trim()},` : t;
      data[lastKey] = `${data[lastKey]}${data[lastKey] ? " " : ""}${item}`;
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    data[key] = line.slice(idx + 1).trim();
    lastKey = key;
  }
  const after = text.slice(end + 4);
  return { data, body: after.replace(/^\n+/, "") };
}

/** Parse the Markdown subset into blocks. */
export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
    if (list) blocks.push(list);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", lang: fence[1] || "text", code: code.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      flush();
      const text = h[2].trim();
      blocks.push({ type: h[1].length === 2 ? "h2" : "h3", text, id: headingId(text) });
      continue;
    }
    const ul = line.match(/^[-*]\s+(.+)$/);
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (para.length) {
        blocks.push({ type: "p", text: para.join(" ") });
        para = [];
      }
      if (!list || list.type !== type) {
        if (list) blocks.push(list);
        list = { type, items: [] };
      }
      list.items.push((ul ?? ol)![1].trim());
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      // Continuation of the previous list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (list) {
      blocks.push(list);
      list = null;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Split the trailing "## FAQ" section into question and answer pairs. */
function splitFaq(blocks: Block[]): { body: Block[]; faq: Faq[] } {
  const at = blocks.findIndex((b) => b.type === "h2" && /^faq$/i.test(b.text.trim()));
  if (at === -1) return { body: blocks, faq: [] };
  const faq: Faq[] = [];
  let current: Faq | null = null;
  for (const b of blocks.slice(at + 1)) {
    if (b.type === "h3") {
      current = { q: b.text, a: "" };
      faq.push(current);
    } else if (b.type === "p" && current) {
      current.a = current.a ? `${current.a} ${b.text}` : b.text;
    }
  }
  return { body: blocks.slice(0, at), faq };
}

/** Parse one answer file. Never throws: problems are reported by validateAnswers. */
export function parseAnswer(file: string, raw: string): Answer {
  const { data, body } = parseFrontmatter(raw);
  const blocks = parseBlocks(body);
  const first = blocks[0];
  const answer = first && first.type === "p" ? first.text : "";
  const rest = first && first.type === "p" ? blocks.slice(1) : blocks;
  const { body: content, faq } = splitFaq(rest);
  return {
    slug: slugFromFilename(file),
    title: unquote(data.title ?? ""),
    description: unquote(data.description ?? ""),
    published: unquote(data.published ?? ""),
    updated: unquote(data.updated ?? data.published ?? ""),
    tags: data.tags ? parseList(data.tags) : [],
    related: data.related ? parseList(data.related) : [],
    answer,
    body: content,
    faq,
  };
}

/** Newest first: by updated, then published, then slug for a stable order. */
export function sortAnswers(answers: Answer[]): Answer[] {
  return [...answers].sort(
    (a, b) =>
      b.updated.localeCompare(a.updated) ||
      b.published.localeCompare(a.published) ||
      a.slug.localeCompare(b.slug),
  );
}

/* ------------------------------------------------------------------ inline */

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string };

/** Tokenise inline Markdown: `code`, **bold** and [text](href). Everything else is text. */
export function tokenizeInline(s: string): InlineToken[] {
  const out: InlineToken[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: s.slice(last, at) });
    if (m[1] !== undefined) out.push({ kind: "code", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "strong", text: m[2] });
    else out.push({ kind: "link", text: m[3], href: m[4] });
    last = at + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", text: s.slice(last) });
  return out;
}

/** Plain text of an inline Markdown string: markup removed, link text kept. */
export function inlineToText(s: string): string {
  return tokenizeInline(s)
    .map((t) => t.text)
    .join("");
}

export function wordCount(s: string): number {
  const t = inlineToText(s).trim();
  return t ? t.split(/\s+/).length : 0;
}

/** The whole post as plain text with light Markdown structure, for llms-full.txt. */
export function answerToText(a: Answer): string {
  const out: string[] = [
    `### ${a.title}`,
    "",
    `URL: ${answerUrl(a.slug)}`,
    `Published: ${a.published}. Updated: ${a.updated}.`,
    "",
    inlineToText(a.answer),
  ];
  for (const b of a.body) {
    out.push("");
    if (b.type === "p") out.push(inlineToText(b.text));
    else if (b.type === "h2") out.push(`#### ${inlineToText(b.text)}`);
    else if (b.type === "h3") out.push(`${inlineToText(b.text)}:`);
    else if (b.type === "code") out.push("```" + b.lang, b.code, "```");
    else
      out.push(
        ...b.items.map((it, i) => `${b.type === "ol" ? `${i + 1}.` : "-"} ${inlineToText(it)}`),
      );
  }
  if (a.faq.length) {
    out.push("", "FAQ:");
    for (const f of a.faq) out.push(`- Q: ${inlineToText(f.q)} A: ${inlineToText(f.a)}`);
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ validation */

/** Built from its code point so this file does not itself contain the character it bans. */
const EM_DASH = String.fromCharCode(0x2014);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Every rule a post must meet. Returns a list of problems; empty means valid.
 * `today` is passed in (YYYY-MM-DD) so the check is deterministic and dates stay honest:
 * a post cannot claim to have been published or updated in the future.
 */
export function validateAnswers(answers: Answer[], today: string): string[] {
  const errors: string[] = [];
  const slugs = new Set(answers.map((a) => a.slug));
  const seenSlug = new Set<string>();
  const seenTitle = new Set<string>();

  for (const a of answers) {
    const at = (msg: string) => errors.push(`${a.slug}: ${msg}`);
    if (!SLUG.test(a.slug)) at("slug must be lowercase words joined by single hyphens");
    if (seenSlug.has(a.slug)) at("duplicate slug");
    seenSlug.add(a.slug);
    if (!a.title) at("missing title");
    else if (!a.title.trim().endsWith("?")) at("title must be the question, ending in '?'");
    if (seenTitle.has(a.title.toLowerCase())) at("duplicate title");
    seenTitle.add(a.title.toLowerCase());
    if (a.description.length < 50 || a.description.length > 170) {
      at(`description must be 50 to 170 characters (has ${a.description.length})`);
    }
    if (!isRealDate(a.published)) at("published must be a real YYYY-MM-DD date");
    if (!isRealDate(a.updated)) at("updated must be a real YYYY-MM-DD date");
    if (a.updated < a.published) at("updated is earlier than published");
    if (a.published > today || a.updated > today) at(`dates are later than today (${today})`);
    if (a.tags.length === 0) at("needs at least one tag");
    const words = wordCount(a.answer);
    if (words < ANSWER_MIN_WORDS || words > ANSWER_MAX_WORDS) {
      at(
        `the first paragraph is the direct answer and must be ${ANSWER_MIN_WORDS} to ${ANSWER_MAX_WORDS} words (has ${words})`,
      );
    }
    if (a.body.filter((b) => b.type === "h2").length < 2) {
      at("needs at least two ## sections of depth after the direct answer");
    }
    if (a.faq.length < 2) at("needs a ## FAQ section with at least two ### questions");
    for (const f of a.faq) {
      if (!f.q.trim().endsWith("?")) at(`FAQ question does not end in '?': ${f.q}`);
      if (!f.a.trim()) at(`FAQ question has no answer: ${f.q}`);
    }
    if (answers.length > 1 && a.related.length === 0) {
      at("needs at least one related slug, so posts cross-link");
    }
    for (const r of a.related) {
      if (r === a.slug) at("related lists itself");
      else if (!slugs.has(r)) at(`related slug does not exist: ${r}`);
    }
    const allText = [
      a.title,
      a.description,
      a.answer,
      ...a.body.map((b) =>
        b.type === "code" ? b.code : "items" in b ? b.items.join(" ") : b.text,
      ),
      ...a.faq.flatMap((f) => [f.q, f.a]),
    ].join("\n");
    if (allText.includes(EM_DASH)) at("contains an em dash (house style)");
    for (const m of allText.matchAll(/\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      if (!href.startsWith("/") && !href.startsWith("https://")) {
        at(`link must be a site path or https URL: ${href}`);
      }
    }
  }
  return errors;
}

/* ------------------------------------------------------------------ feed */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 822 date at 00:00 UTC, as RSS requires. */
export function rfc822(day: string): string {
  return new Date(`${day}T00:00:00Z`).toUTCString();
}

/**
 * RSS 2.0 feed of every answer, newest first. Deterministic: lastBuildDate is the newest
 * `updated` date, not the time of the request, so the feed changes only when content does.
 */
export function buildRss(answers: Answer[]): string {
  const sorted = sortAnswers(answers);
  const self = `${APP_ORIGIN}${ANSWERS_FEED_PATH}`;
  const newest = sorted[0]?.updated;
  const items = sorted
    .map((a) => {
      const url = answerUrl(a.slug);
      return [
        "    <item>",
        `      <title>${xmlEscape(a.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${rfc822(a.published)}</pubDate>`,
        `      <description>${xmlEscape(inlineToText(a.answer))}</description>`,
        ...a.tags.map((t) => `      <category>${xmlEscape(t)}</category>`),
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Legibility answers</title>",
    `    <link>${APP_ORIGIN}${ANSWERS_PATH}</link>`,
    `    <atom:link href="${self}" rel="self" type="application/rss+xml"/>`,
    "    <description>Direct answers to the questions developers and agents ask about MCP, paying per call with x402, and reading typed product data.</description>",
    "    <language>en-gb</language>",
    ...(newest ? [`    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`] : []),
    items,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((l) => l !== "")
    .join("\n")
    .concat("\n");
}
