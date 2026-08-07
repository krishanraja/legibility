import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MCP endpoint: JSON-RPC 2.0 conformance plus the x402 paywall.
 *
 * Two things make this worth testing carefully. First, it is hand-rolled JSON-RPC rather
 * than the SDK, so protocol conformance is our responsibility: a client that cannot parse
 * `initialize` never gets as far as reporting a useful error. Second, it is the only route
 * where an unauthenticated caller can legitimately proceed, by paying. Getting that branch
 * wrong either gives work away or rejects valid payment.
 *
 * The ordering rule under test: request shape is validated BEFORE any charge, so a
 * malformed call is rejected for free rather than after taking someone's USDC.
 */

const h = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  rateCheck: vi.fn(),
  entitlementCheck: vi.fn(),
  settle: vi.fn(),
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/api-keys.server", () => ({ validateApiKey: h.validateApiKey }));

vi.mock("@/integrations/supabase/rate-limit.server", () => ({
  rateCheck: h.rateCheck,
  rateHeaders: () => ({ "x-ratelimit-limit": "60" }),
}));

vi.mock("@/integrations/supabase/entitlement.server", () => ({
  entitlementCheck: h.entitlementCheck,
  quotaBlockedBody: () => ({ error: "quota_exceeded" }),
}));

vi.mock("@/lib/api/x402.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/x402.server")>();
  return { ...actual, settle: h.settle };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === "usage_events") h.inserts.push(row);
        return Promise.resolve({ error: null });
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

const PRINCIPAL = { userId: "user-1", keyId: "key-1" };
const AUTH = { authorization: "Bearer lgk_valid" };

async function call(body: unknown, headers: Record<string, string> = {}, method = "POST") {
  const mod = await import("./mcp");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  const request = new Request("https://legibility.io/api/mcp", {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  });
  return handlers[method]({ request });
}

function stubWorker(bodyText: string, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ status, text: async () => bodyText }) as Response),
  );
}

const ENVELOPE = JSON.stringify({ product: { title: "X" }, confidence: 0.9, cost_usd: 0.004 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  h.inserts.length = 0;
  process.env.PLINTH_EXTRACTOR_URL = "https://legibility-worker.vercel.app/extract";
  process.env.PLINTH_EXTRACTOR_TOKEN = "worker-token";
  h.validateApiKey.mockResolvedValue(PRINCIPAL);
  h.rateCheck.mockResolvedValue({ allowed: true, limit: 60, used: 1, reset: 60 });
  h.entitlementCheck.mockResolvedValue({ allowed: true });
});

describe("MCP: JSON-RPC conformance", () => {
  it("returns -32700 on an unparseable body", async () => {
    const body = await (await call("{not json")).json();
    expect(body.error.code).toBe(-32700);
    expect(body.jsonrpc).toBe("2.0");
  });

  it("answers initialize with capabilities and serverInfo", async () => {
    const body = await (await call({ jsonrpc: "2.0", id: 1, method: "initialize" })).json();
    expect(body.id).toBe(1);
    expect(body.result.serverInfo.name).toBe("legibility-mcp");
    expect(body.result.capabilities).toHaveProperty("tools");
  });

  it("echoes the client's requested protocolVersion", async () => {
    const body = await (
      await call({
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      })
    ).json();
    expect(body.result.protocolVersion).toBe("2025-03-26");
  });

  it("answers ping with an empty result", async () => {
    const body = await (await call({ id: 7, method: "ping" })).json();
    expect(body.result).toEqual({});
    expect(body.id).toBe(7);
  });

  it("returns 202 with no body for the initialized notification", async () => {
    const res = await call({ method: "notifications/initialized" });
    expect(res.status).toBe(202);
  });

  it("accepts the bare initialized alias too", async () => {
    expect((await call({ method: "initialized" })).status).toBe(202);
  });

  it("lists exactly the tools that are actually wired to MCP", async () => {
    const body = await (await call({ id: 2, method: "tools/list" })).json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    // compare_products and brief_product are REST-only. Listing them here would make the
    // server advertise capabilities it does not have.
    expect(names).toEqual(["read_product", "resolve_product"]);
  });

  it("gives every listed tool an inputSchema, which clients require", async () => {
    const body = await (await call({ id: 2, method: "tools/list" })).json();
    for (const t of body.result.tools) {
      expect(t.inputSchema).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });

  it("returns -32601 for an unknown method", async () => {
    const body = await (await call({ id: 3, method: "resources/list" })).json();
    expect(body.error.code).toBe(-32601);
  });

  it("nulls the id when the client omitted it, rather than dropping the field", async () => {
    const body = await (await call({ method: "ping" })).json();
    expect(body).toHaveProperty("id", null);
  });

  it("rejects GET with 405 and an Allow header", async () => {
    const res = await call(null, {}, "GET");
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });
});

describe("MCP: tools/call validation happens before charging", () => {
  it("returns -32602 for an unknown tool", async () => {
    const body = await (
      await call({ id: 4, method: "tools/call", params: { name: "delete_everything" } })
    ).json();
    expect(body.error.code).toBe(-32602);
  });

  it("rejects a read_product call with neither url nor gtin, without auth or payment", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const res = await call({
      id: 5,
      method: "tools/call",
      params: { name: "read_product", arguments: {} },
    });
    // Not a 402: the request was malformed, so it is refused for free.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(h.settle).not.toHaveBeenCalled();
  });

  it("rejects a read_product call with BOTH url and gtin for free", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const body = await (
      await call({
        id: 5,
        method: "tools/call",
        params: { name: "read_product", arguments: { url: "https://x.com/p", gtin: "1" } },
      })
    ).json();
    expect(body.result.isError).toBe(true);
  });

  it("rejects a resolve_product call with too short a name for free", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const body = await (
      await call({
        id: 6,
        method: "tools/call",
        params: { name: "resolve_product", arguments: { name: "a" } },
      })
    ).json();
    expect(body.result.isError).toBe(true);
    expect(h.settle).not.toHaveBeenCalled();
  });
});

describe("MCP: the x402 paywall", () => {
  const READ = {
    id: 8,
    method: "tools/call",
    params: { name: "read_product", arguments: { gtin: "8076800195057" } },
  };

  it("returns 402 with payment requirements when there is no key and no payment", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const res = await call(READ);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(1);
    expect(body.accepts[0].scheme).toBe("exact");
    expect(body.accepts[0].network).toBe("base-sepolia");
  });

  it("does not call the worker when payment is required but absent", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await call(READ);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 402 with the settlement reason when payment fails to settle", async () => {
    h.validateApiKey.mockResolvedValue(null);
    h.settle.mockResolvedValue({ ok: false, reason: "insufficient_balance" });
    const res = await call(READ, { "x-payment": "eyJzaWciOiIweCJ9" });
    expect(res.status).toBe(402);
    expect((await res.json()).settle_error).toBe("insufficient_balance");
  });

  it("proceeds to the worker once payment settles", async () => {
    h.validateApiKey.mockResolvedValue(null);
    h.settle.mockResolvedValue({ ok: true, settleHeader: "c2V0dGxlZA==" });
    stubWorker(ENVELOPE);
    const res = await call(READ, { "x-payment": "eyJzaWciOiIweCJ9" });
    expect(res.status).toBe(200);
    expect(h.settle).toHaveBeenCalledOnce();
  });

  it("does not meter an x402 call against any account", async () => {
    // The payment is settled on-chain by the facilitator. Metering it against an account
    // would double-charge, and there is no account to charge in the first place.
    h.validateApiKey.mockResolvedValue(null);
    h.settle.mockResolvedValue({ ok: true, settleHeader: "c2V0dGxlZA==" });
    stubWorker(ENVELOPE);
    await call(READ, { "x-payment": "eyJzaWciOiIweCJ9" });
    expect(h.inserts).toHaveLength(0);
  });

  it("does not rate-limit or quota-check an x402 call", async () => {
    h.validateApiKey.mockResolvedValue(null);
    h.settle.mockResolvedValue({ ok: true, settleHeader: "c2V0dGxlZA==" });
    stubWorker(ENVELOPE);
    await call(READ, { "x-payment": "eyJzaWciOiIweCJ9" });
    expect(h.rateCheck).not.toHaveBeenCalled();
    expect(h.entitlementCheck).not.toHaveBeenCalled();
  });

  it("never asks for payment when a valid key is presented", async () => {
    stubWorker(ENVELOPE);
    const res = await call(READ, AUTH);
    expect(res.status).toBe(200);
    expect(h.settle).not.toHaveBeenCalled();
  });
});

describe("MCP: keyed calls are metered", () => {
  const READ = {
    id: 9,
    method: "tools/call",
    params: { name: "read_product", arguments: { gtin: "8076800195057" } },
  };

  it("writes a usage row for a keyed call", async () => {
    stubWorker(ENVELOPE);
    await call(READ, AUTH);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({ user_id: "user-1", endpoint: "/api/mcp" });
  });

  it("applies the quota gate to keyed calls", async () => {
    h.entitlementCheck.mockResolvedValue({ allowed: false, reason: "quota_exceeded" });
    const res = await call(READ, AUTH);
    expect(res.status).toBe(402);
  });
});
