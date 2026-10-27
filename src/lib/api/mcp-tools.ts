// A6 + A7: what the MCP server says about itself, in one place.
//
// The tool list served by /api/mcp, the discovery document at /.well-known/mcp.json and the
// MCP Registry's server.json all read from here, so a directory reviewer sees the same words
// everywhere. The reviewer's question is "would a reviewer find any tool description that
// overstates what it does?", so every description states the real scope: structured pages,
// Shopify and barcodes; the 0.7 trust gate; an honest null when a read is not safe; x402 on
// testnet. OVERCLAIMS is the lint that keeps it that way.
import { APP_ORIGIN, MCP_URL } from "@/config/product";

export const PROTOCOL_VERSION = "2025-06-18";

/** The server's name and version, as initialize reports them and server.json publishes them. */
export const SERVER_INFO = {
  name: "legibility-mcp",
  title: "Legibility",
  version: "0.4.0",
} as const;

/** The MCP Registry name: reverse DNS of the domain Krish verifies when he publishes. */
export const REGISTRY_NAME = "io.legibility/mcp";

/** Words no description may use: each claims more than the product reads today. */
export const OVERCLAIMS: RegExp[] = [
  /\bany (website|site|url|page|store|product)\b/i,
  /\ball (stores|websites|sites|retailers|products)\b/i,
  /\bevery (website|site|store|retailer|product)\b/i,
  /\bguarantee/i,
  /\bmainnet\b/i,
  /\b100 ?%/i,
  /\balways (accurate|correct|right)\b/i,
];

export function overclaims(text: string): string[] {
  return OVERCLAIMS.filter((re) => re.test(text)).map((re) => re.source);
}

/**
 * The structured result of read_product and resolve_product: the worker's envelope. Only what
 * the app can vouch for is constrained; the worker may add fields (sources, as_of, input), so
 * further properties are allowed. envelopeConforms() checks exactly these rules at run time,
 * and a result that does not conform is returned as an error, never as structuredContent.
 */
export const ENVELOPE_SCHEMA = {
  type: "object",
  properties: {
    request_id: { type: ["string", "null"], description: "The worker's id for this read." },
    product: {
      type: ["object", "null"],
      description:
        "The typed product (title, brand, gtin or sku, price band, availability), or null when no trusted object could be read.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Calibrated probability the product is correct. 0.7 is the trust gate.",
    },
    field_confidence: {
      type: ["object", "null"],
      additionalProperties: { type: ["number", "null"] },
      description: "Calibrated confidence per field.",
    },
    legibility_id: {
      type: ["string", "null"],
      description: "Stable opaque id for a trusted product.",
    },
    method: {
      type: ["string", "null"],
      description: "How it was read: jsonld, shopify, opengraph, gtin, name or cache.",
    },
    calibration_version: { type: ["string", "null"] },
    cost_usd: { type: "number", minimum: 0, description: "What this call cost, in USD." },
    cached: { type: "boolean" },
  },
  required: ["product", "confidence"],
  additionalProperties: true,
} as const;

const SCOPE =
  "Trusted coverage is structured data: product pages that serve schema.org Product JSON-LD, Shopify stores and GTIN barcodes, plus OpenGraph pages admitted through a verified prior.";
const HONEST_NULL =
  "Below the 0.7 trust gate, or when a page is not safe to read (blocked, a 404, not a product), it returns product: null with a low confidence instead of a guess, and that read is not charged.";
const PAYMENT =
  "Pay with a Legibility API key, or per call in USDC over x402 on Base Sepolia (testnet).";

export const TOOLS = [
  {
    name: "read_product",
    title: "Read a product",
    description: `Read one product page URL or GTIN barcode into a typed product with per-field and overall calibrated confidence, a price band, the extraction method and the cost of the call. ${SCOPE} ${HONEST_NULL} ${PAYMENT}`,
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Product page URL" },
        gtin: { type: "string", description: "GTIN / UPC / EAN barcode" },
        min_confidence: { type: "number", description: "Override the 0.7 trust gate (0 to 1)" },
      },
    },
    outputSchema: ENVELOPE_SCHEMA,
    annotations: {
      title: "Read a product",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "resolve_product",
    title: "Resolve a product name",
    description: `Resolve a product name someone typed into one typed product: a web search finds candidate pages, then the best candidate is read as read_product reads a page, in the same call. ${SCOPE} ${HONEST_NULL} When search is unavailable or no candidate can be read safely, it also returns product: null. ${PAYMENT}`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name, as a person would type it" },
        min_confidence: { type: "number", description: "Override the 0.7 trust gate (0 to 1)" },
      },
      required: ["name"],
    },
    outputSchema: ENVELOPE_SCHEMA,
    annotations: {
      title: "Resolve a product name",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
] as const;

function isNullableString(v: unknown) {
  return v === undefined || v === null || typeof v === "string";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Whether a parsed worker body satisfies ENVELOPE_SCHEMA, rule for rule. */
export function envelopeConforms(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const v = value;
  if (!("product" in v) || !(v.product === null || isPlainObject(v.product))) return false;
  if (typeof v.confidence !== "number" || !(v.confidence >= 0 && v.confidence <= 1)) return false;
  if (v.field_confidence !== undefined && v.field_confidence !== null) {
    if (!isPlainObject(v.field_confidence)) return false;
    if (Object.values(v.field_confidence).some((x) => x !== null && typeof x !== "number")) {
      return false;
    }
  }
  for (const k of ["request_id", "legibility_id", "method", "calibration_version"]) {
    if (!isNullableString(v[k])) return false;
  }
  if (v.cost_usd !== undefined && !(typeof v.cost_usd === "number" && v.cost_usd >= 0)) {
    return false;
  }
  if (v.cached !== undefined && typeof v.cached !== "boolean") return false;
  return true;
}

/**
 * A tools/call result for the worker's answer. A 200 envelope that conforms carries
 * structuredContent beside the same JSON as text. Anything else is an error result with the
 * text only, so a client validating against outputSchema never receives a mismatch.
 */
export function toolCallResult(text: string, status: number) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not JSON: an error result below */
  }
  if (status === 200 && envelopeConforms(parsed)) {
    return { content: [{ type: "text", text }], structuredContent: parsed, isError: false };
  }
  return { content: [{ type: "text", text }], isError: true };
}

// ---------------------------------------------------------------- the discovery document

const ROLE_ADDRESS = /^[a-z0-9][a-z0-9._+-]{0,63}@legibility\.io$/i;

/**
 * The public contact, from configuration (MCP_CONTACT_EMAIL). Only an address on the
 * legibility.io domain is published: anything else, or nothing, leaves the contact out rather
 * than falling back to a person's own address.
 */
export function contactFrom(env: Record<string, string | undefined>): string | null {
  const v = env.MCP_CONTACT_EMAIL?.trim();
  return v && ROLE_ADDRESS.test(v) ? v.toLowerCase() : null;
}

/** /.well-known/mcp.json, built from the same tool list the server serves. */
export function mcpManifest(contact: string | null) {
  return {
    schema_version: "1.0",
    name: "legibility",
    display_name: "Legibility",
    description:
      "Typed product data for AI agents. Reads a product URL or GTIN barcode, or resolves a product name, into a typed product with per-field confidence, a price band, the extraction method and the cost of the call. Trusted coverage is structured pages, Shopify stores and barcodes; below the 0.7 trust gate it returns null rather than a guess.",
    homepage: APP_ORIGIN,
    documentation: `${APP_ORIGIN}/docs/mcp`,
    mcp: {
      protocol_version: PROTOCOL_VERSION,
      transport: "http",
      endpoint: MCP_URL,
      discovery: "free",
      auth: [
        {
          type: "bearer_api_key",
          prefix: "lgk_",
          description: `Create a key at ${APP_ORIGIN} in the dashboard. Required for tools/call unless paying per call over x402.`,
        },
        {
          type: "x402",
          network: "base-sepolia",
          asset: "USDC",
          description:
            "Per-call payment. tools/call returns HTTP 402 with payment requirements when no valid key or X-PAYMENT header is presented. Testnet only.",
        },
      ],
      tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description })),
    },
    rest_api: {
      base_url: `${APP_ORIGIN}/api/v1`,
      note: "compare_products and brief_product are available over REST only, not yet on the MCP tool list.",
    },
    pricing: {
      free_tier: "1000 trusted reads per month, no card, hard stop",
      paid_tiers: `see ${APP_ORIGIN}/docs/quickstart and ${APP_ORIGIN}#pricing`,
      per_call: "x402 on Base Sepolia (testnet)",
    },
    ...(contact ? { contact } : {}),
  };
}

// ------------------------------------------------- MCP Registry domain verification (HTTP)

const ED25519_PUBLIC_KEY = /^[A-Za-z0-9+/]{43}=$/;

/**
 * The body of /.well-known/mcp-registry-auth, which the MCP Registry fetches to verify that
 * whoever publishes io.legibility/mcp controls legibility.io (its HTTP method, so no DNS change
 * is needed). The public half of Krish's publishing key comes from configuration
 * (MCP_REGISTRY_AUTH_PUBLIC_KEY, base64 ed25519); with none, the route answers 404.
 */
export function registryAuthBody(env: Record<string, string | undefined>): string | null {
  const key = env.MCP_REGISTRY_AUTH_PUBLIC_KEY?.trim();
  return key && ED25519_PUBLIC_KEY.test(key) ? `v=MCPv1; k=ed25519; p=${key}` : null;
}
