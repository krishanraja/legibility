/**
 * Print the weekly answer-hub brief: an issue title and body for the week, built from the
 * committed backlog and the posts already published. Deterministic and offline: no network,
 * no model, no secrets. The workflow that calls it opens the issue.
 *
 *   bun scripts/answers-brief.ts --title          the issue title only
 *   bun scripts/answers-brief.ts                  the issue body (Markdown)
 *   bun scripts/answers-brief.ts --date 2026-10-26   as of a given day (default: today, UTC)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAnswersFromDisk } from "../src/lib/answers-fs";
import { sortAnswers } from "../src/lib/answers";
import { briefBody, briefTitle, parseBacklog } from "../src/lib/answers-brief";

const ROOT = resolve(import.meta.dir, "..");

function main() {
  const args = process.argv.slice(2);
  const dateArg = args.indexOf("--date");
  const day = dateArg >= 0 ? args[dateArg + 1] : new Date().toISOString().slice(0, 10);
  if (args.includes("--title")) {
    console.log(briefTitle(day));
    return;
  }
  const backlog = parseBacklog(readFileSync(resolve(ROOT, "docs/answers-backlog.md"), "utf8"));
  const published = sortAnswers(loadAnswersFromDisk(ROOT)).map((a) => a.slug);
  process.stdout.write(briefBody(day, backlog, published));
}

if (import.meta.main) main();
