import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MCP_URL } from "@/config/product";
import { OVERCLAIMS, TOOLS } from "@/lib/api/mcp-tools";
import { MANIFEST_PATH, McpDocs } from "./McpDocs";

/**
 * a10: /docs/mcp is the documentation the manifest hands directory reviewers, so it must show
 * the tool list the server really serves, say how a key authenticates, link the manifest, and
 * never claim mainnet.
 */

const html = renderToStaticMarkup(<McpDocs />);
const decoded = html
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&");

describe("/docs/mcp", () => {
  it("renders every tool tools/list serves, with its title", () => {
    expect(TOOLS.length).toBeGreaterThan(0);
    for (const t of TOOLS) {
      expect(html).toContain(t.name);
      expect(html).toContain(t.title);
    }
  });

  it("says how an API key authenticates", () => {
    expect(decoded).toContain(MCP_URL);
    expect(decoded).toContain('"Authorization": "Bearer lgk_your_key"');
  });

  it("links the manifest", () => {
    expect(html).toContain(`href="${MANIFEST_PATH}"`);
    expect(MANIFEST_PATH).toBe("/.well-known/mcp.json");
  });

  it("states testnet and claims no mainnet date", () => {
    expect(html).toContain("No mainnet settlement yet.");
    expect(html).not.toMatch(/mainnet (flip|on GA|launch|is live)/i);
    const withoutDisclaimer = html.replace("No mainnet settlement yet.", "");
    for (const re of OVERCLAIMS) expect(withoutDisclaimer, re.source).not.toMatch(re);
    expect(html).not.toContain(String.fromCharCode(0x2014));
  });
});
