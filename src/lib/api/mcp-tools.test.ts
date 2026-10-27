import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MCP_URL } from "@/config/product";
import heroReads from "@/data/hero-reads.json";
import {
  ENVELOPE_SCHEMA,
  OVERCLAIMS,
  REGISTRY_NAME,
  SERVER_INFO,
  TOOLS,
  contactFrom,
  registryAuthBody,
  envelopeConforms,
  mcpManifest,
  overclaims,
  toolCallResult,
} from "./mcp-tools";

const ROOT = resolve(__dirname, "../../..");
// The MCP Registry's published schema, vendored byte for byte from
// https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json (the version
// every server listed in the registry used on 2026-10-27).
const REGISTRY_SCHEMA_SHA256 = "3fba09590c99f61735d234822279f4223fab9e300c0a81e81c91ab62a4114de0";

// Synthetic, built at run time so no address is written into this file.
const ROLE = ["listings", "legibility.io"].join("@");
const PERSONAL = ["someone", "example.invalid"].join("@");

const envelopeValidator = new Ajv2020({ strict: false }).compile(ENVELOPE_SCHEMA);

const GOOD = [
  ...heroReads.reads,
  { product: null, confidence: 0.12, cost_usd: 0, method: null, cached: false },
  { product: { title: "x" }, confidence: 0.7, field_confidence: { title: null } },
];
const BAD = [
  null,
  [],
  "text",
  {},
  { product: "x", confidence: 0.9 },
  { product: null },
  { product: null, confidence: 1.2 },
  { product: null, confidence: -0.1 },
  { product: null, confidence: "0.9" },
  { product: null, confidence: 0.5, field_confidence: [] },
  { product: null, confidence: 0.5, field_confidence: { title: "high" } },
  { product: null, confidence: 0.5, method: 3 },
  { product: null, confidence: 0.5, legibility_id: {} },
  { product: null, confidence: 0.5, cost_usd: -1 },
  { product: null, confidence: 0.5, cost_usd: "0.1" },
  { product: null, confidence: 0.5, cached: "no" },
];

describe("A7: the tools", () => {
  it("each tool has a plain title, an output schema and honest annotations", () => {
    expect(TOOLS.map((t) => [t.name, t.title])).toEqual([
      ["read_product", "Read a product"],
      ["resolve_product", "Resolve a product name"],
    ]);
    for (const t of TOOLS) {
      expect(t.outputSchema).toBe(ENVELOPE_SCHEMA);
      expect(t.annotations).toEqual({
        title: t.title,
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      });
      // Each call is metered against the caller's quota, so it is not claimed idempotent.
      expect("idempotentHint" in t.annotations).toBe(false);
    }
  });

  it("every description states the real scope: structured pages, Shopify, barcodes, the gate, a null, testnet", () => {
    for (const t of TOOLS) {
      for (const needle of [
        "JSON-LD",
        "Shopify",
        "GTIN",
        "0.7 trust gate",
        "product: null",
        "testnet",
      ]) {
        expect(t.description, `${t.name} ${needle}`).toContain(needle);
      }
    }
  });

  it("the overclaim lint passes on every description, and fails on each banned claim", () => {
    for (const t of TOOLS) expect(overclaims(`${t.title} ${t.description}`)).toEqual([]);
    expect(overclaims(mcpManifest(null).description)).toEqual([]);
    const serverJson = JSON.parse(readFileSync(resolve(ROOT, "server.json"), "utf8"));
    expect(overclaims(`${serverJson.title} ${serverJson.description}`)).toEqual([]);
    for (const claim of [
      "Reads any website.",
      "Works on all stores.",
      "Covers every retailer.",
      "Guaranteed results.",
      "Pay on mainnet.",
      "100% accurate.",
      "Always accurate.",
    ]) {
      expect(overclaims(claim), claim).not.toEqual([]);
    }
    expect(OVERCLAIMS.length).toBe(7);
  });
});

describe("A7: the output schema", () => {
  it("is a valid JSON Schema, and real captured reads satisfy it", () => {
    for (const r of GOOD) expect(envelopeValidator(r), JSON.stringify(r)).toBe(true);
  });

  it("the run-time check agrees with the schema, case by case", () => {
    for (const r of GOOD) expect(envelopeConforms(r)).toBe(true);
    for (const r of BAD) {
      expect(envelopeConforms(r), JSON.stringify(r)).toBe(false);
      expect(envelopeValidator(r), JSON.stringify(r)).toBe(false);
    }
  });

  it("a conforming 200 returns structuredContent that validates, beside the same text", () => {
    const text = JSON.stringify(heroReads.reads[0]);
    const r = toolCallResult(text, 200);
    expect(r.isError).toBe(false);
    expect(r.content).toEqual([{ type: "text", text }]);
    expect(envelopeValidator(r.structuredContent)).toBe(true);
  });

  it("an upstream failure, a non-JSON body or a non-conforming body is an error without structuredContent", () => {
    for (const [text, status] of [
      [JSON.stringify(heroReads.reads[0]), 502],
      ["<html>", 200],
      [JSON.stringify({ error: "upstream_unavailable" }), 200],
    ] as const) {
      const r = toolCallResult(text, status);
      expect(r.isError).toBe(true);
      expect("structuredContent" in r).toBe(false);
    }
  });
});

describe("A6: the discovery document", () => {
  it("publishes only a role address on the legibility.io domain from configuration", () => {
    expect(contactFrom({ MCP_CONTACT_EMAIL: ` ${ROLE.toUpperCase()} ` })).toBe(ROLE);
    expect(contactFrom({ MCP_CONTACT_EMAIL: PERSONAL })).toBeNull();
    expect(contactFrom({ MCP_CONTACT_EMAIL: `${ROLE}.evil.example` })).toBeNull();
    expect(contactFrom({ MCP_CONTACT_EMAIL: "" })).toBeNull();
    expect(contactFrom({})).toBeNull();
  });

  it("carries the contact only when one is configured, and the same tools the server serves", () => {
    expect(mcpManifest(ROLE).contact).toBe(ROLE);
    expect("contact" in mcpManifest(null)).toBe(false);
    const m = mcpManifest(null);
    expect(m.mcp.endpoint).toBe(MCP_URL);
    expect(m.mcp.tools).toEqual(
      TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description })),
    );
    expect(JSON.stringify(m)).not.toContain("@");
  });
});

describe("A7: server.json for the MCP Registry", () => {
  const schemaBytes = readFileSync(
    resolve(ROOT, "src/test/vendor/mcp-registry/server.schema.2025-12-11.json"),
  );
  const serverJson = JSON.parse(readFileSync(resolve(ROOT, "server.json"), "utf8"));

  it("the vendored schema is the published 2025-12-11 one", () => {
    expect(createHash("sha256").update(schemaBytes).digest("hex")).toBe(REGISTRY_SCHEMA_SHA256);
  });

  it("validates against the registry's schema", () => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(schemaBytes.toString("utf8")));
    expect(validate(serverJson), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...serverJson, name: "no-slash" })).toBe(false);
  });

  it("names the server, version and remote the app serves", () => {
    expect(serverJson.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    );
    expect(serverJson.name).toBe(REGISTRY_NAME);
    expect(serverJson.version).toBe(SERVER_INFO.version);
    expect(serverJson.remotes).toEqual([{ type: "streamable-http", url: MCP_URL }]);
  });
});

describe("A7: registry domain verification over HTTP", () => {
  // A synthetic 32-byte public key, never anyone's real key.
  const KEY = Buffer.alloc(32, 7).toString("base64");

  it("serves the registry's record for a well-formed public key, and nothing otherwise", () => {
    expect(registryAuthBody({ MCP_REGISTRY_AUTH_PUBLIC_KEY: ` ${KEY} ` })).toBe(
      `v=MCPv1; k=ed25519; p=${KEY}`,
    );
    expect(registryAuthBody({ MCP_REGISTRY_AUTH_PUBLIC_KEY: "short" })).toBeNull();
    expect(registryAuthBody({})).toBeNull();
  });
});
