import { afterEach, describe, expect, it } from "vitest";

/** A6: the discovery document, served from code with a configured role contact. */

// Synthetic, built at run time so no address is written into this file.
const ROLE = ["listings", "legibility.io"].join("@");
const PERSONAL = ["someone", "example.invalid"].join("@");

async function get() {
  const mod = await import("./[.]well-known.mcp[.]json");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  return handlers.GET() as Promise<Response>;
}

afterEach(() => {
  delete process.env.MCP_CONTACT_EMAIL;
});

describe("GET /.well-known/mcp.json", () => {
  it("returns 200 and valid JSON with the configured role address as its contact", async () => {
    process.env.MCP_CONTACT_EMAIL = ROLE;
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = JSON.parse(await res.text());
    expect(body.contact).toBe(ROLE);
    expect(body.mcp.endpoint).toBe("https://legibility.io/api/mcp");
  });

  it("publishes no contact when the configured one is anything else, or nothing", async () => {
    process.env.MCP_CONTACT_EMAIL = PERSONAL;
    expect("contact" in (await (await get()).json())).toBe(false);
    delete process.env.MCP_CONTACT_EMAIL;
    const text = await (await get()).text();
    expect("contact" in JSON.parse(text)).toBe(false);
    expect(text).not.toContain("@");
  });
});

describe("GET /.well-known/mcp-registry-auth", () => {
  const KEY = Buffer.alloc(32, 7).toString("base64");

  async function auth() {
    const mod = await import("./[.]well-known.mcp-registry-auth");
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
    return (mod.Route as any).options.server.handlers.GET() as Promise<Response>;
  }

  afterEach(() => {
    delete process.env.MCP_REGISTRY_AUTH_PUBLIC_KEY;
  });

  it("is 404 until a public key is configured, then serves the record", async () => {
    expect((await auth()).status).toBe(404);
    process.env.MCP_REGISTRY_AUTH_PUBLIC_KEY = KEY;
    const res = await auth();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(`v=MCPv1; k=ed25519; p=${KEY}`);
  });
});
