/**
 * Static GEO and SEO gate. No network, no secrets, so it runs in Tier 1.
 *
 * These checks exist because of specific defects that actually shipped:
 *   - robots.txt declared each AI crawler as its own group with only `Allow: /`.
 *     robots groups are NOT additive, so every named crawler was permitted into
 *     /dashboard even though `User-agent: *` disallowed it.
 *   - llms.txt advertised a Custom plan, a Slack channel and an SLA that do not exist.
 *   - A find-and-replace left dead brand strings in public-facing files.
 *
 * Each check below maps to one of those. Run: `bun scripts/check-geo.ts`
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

/* ---------------------------------------------------------------------- runner */

checkRobots();
checkSitemap();
checkPlanClaims();
checkDeadBrands();

if (failures.length) {
  for (const f of failures) console.error(`::error::${f}`);
  console.error(`\nGEO check failed with ${failures.length} problem(s).`);
  process.exit(1);
}
console.log("GEO check passed: robots groups, sitemap, plan claims, brand strings all clean.");
