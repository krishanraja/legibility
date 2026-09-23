// One source of truth for every public-facing URL, path, and demo input (PLAN F0.6).
// legibility.io is live (DNS delegated to Vercel + SSL issued); this is the canonical public
// origin. The former hosts onplinth.io, plinth-tan.vercel.app and plinth.sh are dead.

export const APP_ORIGIN = "https://legibility.io";
export const API_BASE = `${APP_ORIGIN}/api/v1`;
export const MCP_URL = `${APP_ORIGIN}/api/mcp`;

// The crawler's declared identity, defined once.
//
// BOT_TOKEN is the product token a robots.txt author writes in a User-agent line, and it is
// what isAllowedByRobots matches on (it splits the full string at the first slash). BOT_UA is
// the header sent on every outbound request. The "+url" convention means "this is who I am",
// so that URL has to resolve: /about/bot exists and is in the sitemap. It was a 404 once,
// which left every site owner who looked us up in their access log with nothing to find.
export const BOT_TOKEN = "LegibilityBot";
export const BOT_VERSION = "0.1";
export const BOT_INFO_URL = `${APP_ORIGIN}/about/bot`;
export const BOT_UA = `${BOT_TOKEN}/${BOT_VERSION} (+${BOT_INFO_URL})`;

// Demo input used in every copy-pasteable sample. A real GTIN that returns a real
// trusted object today (Barilla Spaghetti N.5 via the barcode path, confidence 0.745).
export const DEMO_GTIN = "8076800195057";

// The curl shown on the dashboard and in quickstart docs. Must succeed verbatim
// (with a real key substituted). Never point samples at a domain that does not resolve.
export const demoCurl = (keyPlaceholder = "lgk_your_key") =>
  `curl -X POST ${API_BASE}/read_product \\
  -H "authorization: Bearer ${keyPlaceholder}" \\
  -H "content-type: application/json" \\
  -d '{"gtin":"${DEMO_GTIN}"}'`;
