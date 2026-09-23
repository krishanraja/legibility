/**
 * Generate public/llms-full.txt from llms.txt plus the failure-reason pages.
 *
 * llms.txt is the summary an answer engine reads to know what this product is. llms-full.txt
 * is the convention for the long form: the same claims with the reasoning attached, in one
 * fetch, so a model answering "why can an AI not read my website" has the whole taxonomy
 * rather than a headline and eight links it may not follow.
 *
 * It is generated rather than written, from the same REASON_PAGES the /why pages render, for
 * the same reason calibration.json and plans.json are generated: a second hand-maintained
 * copy of the same claims is a copy that ends up disagreeing with the first. This repo has
 * already shipped that bug once, with an FAQ that had drifted to six questions against seven
 * under a comment claiming they matched.
 *
 *   bun scripts/build-llms-full.ts          write public/llms-full.txt
 *   bun scripts/build-llms-full.ts --check  exit non-zero if the file is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REASON_PAGES, REASON_PAGE_ORDER } from "../src/content/reasons";
import { REASON_COPY, REASON_FIX } from "../src/lib/api/readability";

const ROOT = resolve(import.meta.dir, "..");
const OUT = resolve(ROOT, "public/llms-full.txt");
const ORIGIN = "https://legibility.io";

const summary = readFileSync(resolve(ROOT, "public/llms.txt"), "utf8").trimEnd();

const sections = REASON_PAGE_ORDER.map((reason) => {
  const p = REASON_PAGES[reason];
  return [
    `### ${reason}: ${p.title}`,
    "",
    `URL: ${ORIGIN}/why/${reason}`,
    "",
    p.summary,
    "",
    `Shown to the site owner as: ${REASON_COPY[reason]}`,
    "",
    "What is happening:",
    ...p.what.map((w) => `- ${w}`),
    "",
    "What it costs:",
    ...p.cost.map((c) => `- ${c}`),
    "",
    `The fix: ${REASON_FIX[reason]}`,
    "",
    `Who does it: ${p.effort}`,
  ].join("\n");
}).join("\n\n");

const body = [
  summary,
  "",
  "## Why a page cannot be read: the closed set",
  "",
  `A machine failing to read a page is not one condition, it is ${REASON_PAGE_ORDER.length}. The reason matters more than the verdict, because a site that refuses crawlers made a decision, a site that renders only in JavaScript did not, and a site with clean HTML and no markup is one afternoon away from being fixed. Those carry different costs and different owners, so they are recorded separately. This is the whole set. There is no further reason and no free-text judgement of any site anywhere in this product.`,
  "",
  `Index of these pages: ${ORIGIN}/why`,
  "",
  sections,
  "",
  "## About the crawler",
  "",
  `LegibilityBot identifies itself on every request and the identifying URL resolves: ${ORIGIN}/about/bot. It makes one plain GET of the page, does not execute JavaScript, does not use a proxy or residential address to route around a refusal, submits nothing, and obeys robots.txt. A site that disallows it is recorded as having chosen to, never circumvented. Blocking instructions and a takedown route are on that page.`,
  "",
].join("\n");

const serialised = body.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== serialised) {
    console.error("::error::public/llms-full.txt is stale. Run bun scripts/build-llms-full.ts");
    process.exit(1);
  }
  console.log("llms-full.txt matches its sources.");
} else {
  writeFileSync(OUT, serialised);
  console.log(`Wrote ${OUT} (${serialised.length} bytes).`);
}
