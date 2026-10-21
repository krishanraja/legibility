/**
 * Static GEO and SEO gate. No network, no secrets, so it runs in Tier 1.
 *
 * These checks exist because of specific defects that actually shipped:
 *   - robots.txt declared each AI crawler as its own group with only `Allow: /`.
 *     robots groups are NOT additive, so every named crawler was permitted into
 *     /dashboard even though `User-agent: *` disallowed it.
 *   - llms.txt advertised a Custom plan, a Slack channel and an SLA that do not exist.
 *   - A find-and-replace left dead brand strings in public-facing files.
 *   - og.png still showed the dead "plinth" wordmark and host at 2400x1260, and the favicon
 *     was a 2000x2000 PNG served for a 16 pixel tab.
 *   - Every page but the homepage shared the homepage's og:url and twitter:title.
 *
 * Each check below maps to one of those. Run: `bun scripts/check-geo.ts`
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadAnswersFromDisk } from "../src/lib/answers-fs";
import { answerUrl, validateAnswers } from "../src/lib/answers";
import { DEFAULT_OG_IMAGE, ANSWERS_OG_IMAGE } from "../src/lib/seo";

const ROOT = resolve(import.meta.dir, "..");
const ORIGIN = "https://legibility.io";

const failures: string[] = [];
const fail = (check: string, detail: string) => failures.push(`${check}: ${detail}`);
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

/* ------------------------------------------------------------------ robots.txt */

type RobotsGroup = { agents: string[]; rules: [string, string][] };

/** Parse robots.txt into groups. Consecutive User-agent lines share the rules that follow. */
function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // A User-agent line after a rule starts a NEW group; after another
      // User-agent line it joins the current one.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      if (current) current.rules.push([field, value]);
      lastWasAgent = false;
    } else {
      // sitemap:, host: and friends are non-group records (RFC 9309). They may appear
      // anywhere and do NOT close the group, so rules after one still belong to it. All
      // this does is mark that the next User-agent line starts a new group rather than
      // joining the current one.
      lastWasAgent = false;
    }
  }
  return groups;
}

function checkRobots() {
  const text = read("public/robots.txt");
  const groups = parseRobots(text);

  if (groups.length === 0) return fail("robots", "no user-agent groups parsed");

  for (const g of groups) {
    const disallows = g.rules.filter(([f]) => f === "disallow").map(([, v]) => v);
    if (!disallows.some((v) => v === "/dashboard" || v.startsWith("/dashboard"))) {
      fail(
        "robots",
        `group [${g.agents.join(", ")}] does not disallow /dashboard. ` +
          `robots groups are not additive, so this group ignores the rules under "*".`,
      );
    }
  }

  // The AI agents and assistants that must be explicitly welcome. A name dropped from the
  // group during an edit falls back to "*", which still allows it, so this guards intent
  // (an explicit, reviewed list) rather than access. Add to it as operators publish new agents.
  const REQUIRED_AI_AGENTS = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-User",
    "Claude-SearchBot",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot",
    "Applebot-Extended",
    "meta-externalagent",
    "Amazonbot",
    "DuckAssistBot",
    "MistralAI-User",
    "CCBot",
  ];
  for (const agent of REQUIRED_AI_AGENTS) {
    const g = groups.find((x) => x.agents.some((a) => a.toLowerCase() === agent.toLowerCase()));
    if (!g) fail("robots", `AI agent ${agent} is not named in robots.txt`);
    else if (!g.rules.some(([f, v]) => f === "allow" && v === "/")) {
      fail("robots", `AI agent ${agent} is named but its group does not Allow: /`);
    }
  }

  if (!/^Sitemap:\s*\S+/m.test(text)) fail("robots", "no Sitemap: directive");
  if (!text.includes(`${ORIGIN}/sitemap.xml`)) {
    fail("robots", `Sitemap: does not point at ${ORIGIN}/sitemap.xml`);
  }
}

/* ----------------------------------------------------------------- sitemap.xml */

function checkSitemap() {
  const xml = read("public/sitemap.xml");

  if (!xml.startsWith("<?xml")) fail("sitemap", "missing XML declaration");
  if (!xml.includes("http://www.sitemaps.org/schemas/sitemap/0.9")) {
    fail("sitemap", "missing sitemap namespace");
  }

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) return fail("sitemap", "no <loc> entries");

  for (const loc of locs) {
    if (!loc.startsWith(`${ORIGIN}/`)) {
      fail("sitemap", `<loc> ${loc} does not use the canonical origin ${ORIGIN}`);
    }
    if (loc !== `${ORIGIN}/` && loc.endsWith("/")) {
      fail("sitemap", `<loc> ${loc} has a trailing slash; canonical tags emit none`);
    }
  }

  const dupes = locs.filter((l, i) => locs.indexOf(l) !== i);
  if (dupes.length) fail("sitemap", `duplicate <loc> entries: ${[...new Set(dupes)].join(", ")}`);

  // The homepage must be present or crawlers get no entry point.
  if (!locs.includes(`${ORIGIN}/`)) fail("sitemap", "homepage is missing");
}

/* -------------------------------------------------------- plan claim consistency */

/**
 * llms.txt and the JSON-LD offers must name the same plans.
 *
 * This is the check that would have caught the phantom "Custom" plan: llms.txt listed it,
 * the JSON-LD offers (which mirror the plans table) did not.
 */
function checkPlanClaims() {
  const llms = read("public/llms.txt");
  const root = read("src/routes/__root.tsx");

  const offerNames = [...root.matchAll(/"@type":\s*"Offer",\s*\n?\s*name:\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );
  const jsonLdPlans = new Set(offerNames.map((n) => n.toLowerCase()));

  if (jsonLdPlans.size === 0) return fail("plans", "no JSON-LD Offer entries found in __root.tsx");

  // Plan names llms.txt claims, from its "## Pricing" bullet list.
  const pricing = llms.split(/^## Pricing$/m)[1]?.split(/^## /m)[0] ?? "";
  if (!pricing) return fail("plans", "llms.txt has no ## Pricing section");

  // Only the plan bullets, of the form "- Name: ...". Surrounding prose is excluded on
  // purpose: an explicit denial ("there is no SLA") must not read as a claim.
  const planBullets = [...pricing.matchAll(/^-\s+([A-Z][A-Za-z]*):(.*)$/gm)];

  for (const [, name, entitlements] of planBullets) {
    const plan = name.toLowerCase();
    if (!jsonLdPlans.has(plan)) {
      fail(
        "plans",
        `llms.txt advertises a "${plan}" plan that is not in the JSON-LD offers ` +
          `(${[...jsonLdPlans].join(", ")}). Answer engines quote llms.txt verbatim.`,
      );
    }
    // Entitlements promised on a plan line that the product does not actually deliver.
    for (const [label, re] of [
      ["an SLA", /\bSLA\b/],
      ["a Slack channel", /\bSlack\b/],
    ] as const) {
      if (re.test(entitlements)) {
        fail("plans", `llms.txt promises ${label} on the ${plan} plan, which is not live`);
      }
    }
  }
}

/* ------------------------------------------------------------ dead brand strings */

function checkDeadBrands() {
  const files = [
    "public/llms.txt",
    "public/robots.txt",
    "public/sitemap.xml",
    "public/.well-known/mcp.json",
  ];
  // "plinth" may only appear as an explicit do-not-cite disclaimer, never as a live URL.
  const liveUrl = /https?:\/\/[^\s"']*plinth[^\s"']*/gi;
  for (const f of files) {
    const text = read(f);
    const hits = text.match(liveUrl);
    if (hits) fail("brand", `${f} still contains live old-brand URLs: ${hits.join(", ")}`);
  }
}

/* ------------------------------------------------------- banned marketing phrasing */

/**
 * The front page is written for a buyer who has had twenty vendor emails promising to
 * "optimise your AI visibility" and has learned to distrust the register they are written
 * in. These phrases are the register. They are banned outright rather than discouraged,
 * because the cost of one of them reappearing during a routine copy edit is that the page
 * stops sounding like a lab and starts sounding like the twenty-first email.
 *
 * Scoped to public-facing copy. Internal docs may say what they like.
 */
const BANNED: [string, RegExp][] = [
  ["rapidly evolving landscape", /rapidly evolving|in today's [a-z ]*landscape/i],
  ["unlock", /\bunlock(s|ing|ed)?\b/i],
  ["empower", /\bempower(s|ing|ed|ment)?\b/i],
  ["seamless", /\bseamless(ly)?\b/i],
  ["leverage as a verb", /\bleverag(e|es|ing|ed)\b/i],
  ["revolutionise", /\brevolutionis|revoluti onize|\brevolutionize/i],
  ["game-changing", /game[- ]chang(ing|er)/i],
  ["AI-powered as a self-descriptor", /\bAI[- ]powered\b/i],
  ["cutting edge", /cutting[- ]edge/i],
  ["best in class", /best[- ]in[- ]class/i],
  ["supercharge", /\bsupercharg(e|es|ing|ed)\b/i],
  ["effortless", /\beffortless(ly)?\b/i],
];

/**
 * Public-facing source files: every route a visitor can reach, plus the shared chrome.
 *
 * Authenticated routes are excluded. They are a product surface rather than a marketing one,
 * and nothing there is indexed or quoted.
 */
function publicSourceFiles(): string[] {
  const out: string[] = [
    "src/components/site/SiteHeader.tsx",
    "src/components/site/SiteFooter.tsx",
  ];
  const routes = resolve(ROOT, "src/routes");
  for (const f of readdirSync(routes)) {
    if (!f.endsWith(".tsx")) continue;
    if (f === "__root.tsx") {
      out.push("src/routes/__root.tsx");
      continue;
    }
    // Skip authenticated and api routes. _authenticated is a layout prefix, api.* are handlers.
    if (f.startsWith("_") || f.startsWith("api.")) continue;
    out.push(`src/routes/${f}`);
  }
  return out.sort();
}

function checkBannedPhrasing() {
  // Every public-facing surface, not just the front page.
  //
  // The original four files were the ones that existed when the register was first gated.
  // They left out every /docs route, the legal pages, the site chrome and the failure-reason
  // pages, which is exactly where stale copy had been sitting: the header still said "product
  // data for agents" and /docs opened on the old positioning at sitemap priority 0.9. Those
  // were fixed by hand once. This is what stops them coming back.
  //
  // Discovered rather than listed, so a new public route is covered the day it is added
  // instead of the day someone remembers to add it here. Internal docs are still free to say
  // what they like.
  const files = [
    ...publicSourceFiles(),
    "public/llms.txt",
    "src/lib/api/readability.ts",
    "src/content/reasons.ts",
    ...readdirSync(resolve(ROOT, "src/content/answers"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `src/content/answers/${f}`),
  ];
  for (const f of files) {
    const text = read(f);
    for (const [label, re] of BANNED) {
      const m = text.match(re);
      if (m) {
        fail(
          "copy",
          `${f} contains banned phrasing "${m[0]}" (${label}). This audience punishes it.`,
        );
      }
    }
  }
}

/* --------------------------------------------------------------- icons and cards */

/** Width and height from a PNG's IHDR chunk, or null if the file is not a PNG. */
function pngSize(p: string): { w: number; h: number } | null {
  const b = readFileSync(resolve(ROOT, p));
  if (b.length < 24 || b.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function checkIconsAndCards() {
  const pngs: [string, number, number][] = [
    ["public/favicon-16x16.png", 16, 16],
    ["public/favicon-32x32.png", 32, 32],
    ["public/apple-touch-icon.png", 180, 180],
    ["public/icon-192.png", 192, 192],
    ["public/icon-512.png", 512, 512],
    ["public/icon-maskable-512.png", 512, 512],
    ["public/og.png", DEFAULT_OG_IMAGE.width, DEFAULT_OG_IMAGE.height],
    ["public/og-answers.png", ANSWERS_OG_IMAGE.width, ANSWERS_OG_IMAGE.height],
  ];
  for (const [p, w, h] of pngs) {
    if (!existsSync(resolve(ROOT, p))) {
      fail("icons", `${p} is missing`);
      continue;
    }
    const size = pngSize(p);
    if (!size) fail("icons", `${p} is not a PNG`);
    else if (size.w !== w || size.h !== h) {
      fail("icons", `${p} is ${size.w}x${size.h}, expected ${w}x${h}`);
    }
  }
  if ((DEFAULT_OG_IMAGE.width / DEFAULT_OG_IMAGE.height).toFixed(2) !== "1.90") {
    fail("cards", "the social card must be 1.91:1 (1200x630) for summary_large_image");
  }

  const ico = resolve(ROOT, "public/favicon.ico");
  if (!existsSync(ico)) fail("icons", "public/favicon.ico is missing");
  else if (readFileSync(ico).readUInt16LE(2) !== 1) fail("icons", "favicon.ico is not an ICO");

  const svg = existsSync(resolve(ROOT, "public/favicon.svg")) ? read("public/favicon.svg") : "";
  if (!svg.includes("<svg") || !svg.includes("viewBox")) {
    fail("icons", "public/favicon.svg is missing or not an SVG with a viewBox");
  }

  let manifest: { icons?: { src: string; sizes: string; purpose?: string }[]; name?: string };
  try {
    manifest = JSON.parse(read("public/site.webmanifest"));
  } catch {
    return fail("icons", "public/site.webmanifest is missing or not JSON");
  }
  if (!manifest.name) fail("icons", "site.webmanifest has no name");
  for (const need of ["192x192", "512x512"]) {
    if (!manifest.icons?.some((i) => i.sizes === need)) {
      fail("icons", `site.webmanifest has no ${need} icon`);
    }
  }
  if (!manifest.icons?.some((i) => i.purpose === "maskable")) {
    fail("icons", "site.webmanifest has no maskable icon");
  }
  for (const i of manifest.icons ?? []) {
    if (!existsSync(resolve(ROOT, "public", i.src.replace(/^\//, "")))) {
      fail("icons", `site.webmanifest points at a missing file: ${i.src}`);
    }
  }

  const root = read("src/routes/__root.tsx");
  for (const [label, needle] of [
    ["the SVG favicon", 'href: "/favicon.svg"'],
    ["favicon.ico", 'href: "/favicon.ico"'],
    ["the apple-touch icon", 'href: "/apple-touch-icon.png"'],
    ["the web manifest", 'href: "/site.webmanifest"'],
    ["a theme-color", 'name: "theme-color"'],
    ["site-wide social defaults", "...pageMeta("],
  ] as const) {
    if (!root.includes(needle)) fail("head", `__root.tsx does not emit ${label}`);
  }
}

/* -------------------------------------------------------- per-route social meta */

/**
 * Every public page route must build its head through pageMeta, which is what gives it its own
 * og:url, twitter fields and image dimensions. Layout-only routes are exempt.
 */
function checkRouteMeta() {
  const LAYOUTS = new Set(["src/routes/docs.tsx"]);
  for (const f of publicSourceFiles()) {
    if (!f.startsWith("src/routes/") || f === "src/routes/__root.tsx" || LAYOUTS.has(f)) continue;
    const text = read(f);
    if (!text.includes("createFileRoute(")) continue;
    if (!text.includes("pageMeta(")) {
      fail("meta", `${f} does not build its head with pageMeta, so it has no og:url of its own`);
    }
  }
}

/* --------------------------------------------------------------- agent discovery */

function checkAgentDiscovery() {
  const llms = read("public/llms.txt");
  for (const needle of [
    "https://legibility.io/api/mcp",
    "https://legibility.io/.well-known/mcp.json",
    "https://legibility.io/answers",
    "https://legibility.io/answers/feed.xml",
    "x402",
  ]) {
    if (!llms.includes(needle)) fail("agents", `llms.txt does not mention ${needle}`);
  }
  try {
    const mcp = JSON.parse(read("public/.well-known/mcp.json"));
    if (mcp?.mcp?.endpoint !== `${ORIGIN}/api/mcp`) {
      fail("agents", ".well-known/mcp.json endpoint is not the live MCP URL");
    }
  } catch {
    fail("agents", "public/.well-known/mcp.json is missing or not JSON");
  }
  if (!read("public/robots.txt").includes("/.well-known/mcp.json")) {
    fail("agents", "robots.txt does not point agents at /.well-known/mcp.json");
  }
}

/* ------------------------------------------------------------------- answer hub */

/**
 * The full rules live in validateAnswers and run in the unit tests too. They run here as well
 * so the GEO gate alone says whether the hub is publishable, and so a post missing from the
 * sitemap or llms.txt is named as a GEO failure.
 */
function checkAnswers() {
  const answers = loadAnswersFromDisk(ROOT);
  if (answers.length === 0) return fail("answers", "no posts in src/content/answers");
  const today = new Date().toISOString().slice(0, 10);
  for (const e of validateAnswers(answers, today)) fail("answers", e);
  const sitemap = read("public/sitemap.xml");
  const llms = read("public/llms.txt");
  const full = read("public/llms-full.txt");
  for (const a of answers) {
    const url = answerUrl(a.slug);
    if (!sitemap.includes(`<loc>${url}</loc>`)) fail("answers", `${a.slug} is not in sitemap.xml`);
    if (!llms.includes(url)) fail("answers", `${a.slug} is not listed in llms.txt`);
    if (!full.includes(`URL: ${url}`)) fail("answers", `${a.slug} is not in llms-full.txt`);
  }
}

/* ---------------------------------------------------------------------- runner */

checkRobots();
checkSitemap();
checkPlanClaims();
checkDeadBrands();
checkBannedPhrasing();
checkIconsAndCards();
checkRouteMeta();
checkAgentDiscovery();
checkAnswers();

if (failures.length) {
  for (const f of failures) console.error(`::error::${f}`);
  console.error(`\nGEO check failed with ${failures.length} problem(s).`);
  process.exit(1);
}
console.log(
  "GEO check passed: robots groups and AI agents, sitemap, plan claims, brand strings, copy register, icons and cards, per-route social meta, agent discovery, answer hub.",
);
