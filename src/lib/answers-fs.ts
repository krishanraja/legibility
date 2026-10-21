import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAnswer, type Answer } from "./answers";

/**
 * Read every answer file from disk. Used by the build (sitemap), scripts (llms-full.txt, the
 * weekly brief) and tests. The app itself reads the same files through import.meta.glob in
 * src/content/answers/index.ts, so this module never reaches the browser bundle.
 */
export const ANSWERS_DIR = "src/content/answers";

export function answerFiles(root: string): string[] {
  return readdirSync(resolve(root, ANSWERS_DIR))
    .filter((f) => f.endsWith(".md"))
    .sort();
}

export function loadAnswersFromDisk(root: string): Answer[] {
  return answerFiles(root).map((f) =>
    parseAnswer(f, readFileSync(resolve(root, ANSWERS_DIR, f), "utf8")),
  );
}
