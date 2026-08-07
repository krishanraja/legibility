import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * brief_product is the only route that accepts all three input kinds, and the only one that
 * returns generated prose alongside the typed object. composeBrief itself is tested directly
 * in src/lib/api/brief.test.ts, so what matters here is the route contract: exactly one
 * input, the brief always present even on a null read, and the input echoed back.
 */

const h = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  rateCheck: vi.fn(),
  entitlementCheck: vi.fn(),
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

const AUTH = { authorization: "Bearer lgk_valid" };

const TRUSTED = JSON.stringify({
  product: {
    title: "Wool Runner",
    brand: "Allbirds",
    price: { low: 98, high: 98, currency: "USD", n_sources: 1 },
  },
  confidence: 0.92,
  method: "shopify",
  cost_usd: 0.004,
});

// Note: this route reads the worker response with res.json(), unlike read_product and
// resolve_product which use res.text(). The stub provides both so it stays valid if that
// changes.
function stubWorker(text: string, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        ({ status, text: async () => text, json: async () => JSON.parse(text) }) as Response,
    ),
  );
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  const mod = await import("./brief_product");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  return handlers.POST({
    request: new Request("https://legibility.io/api/v1/brief_product", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  h.inserts.length = 0;
  process.env.PLINTH_EXTRACTOR_URL = "https://legibility-worker.vercel.app/extract";
  process.env.PLINTH_EXTRACTOR_TOKEN = "worker-token";
  h.validateApiKey.mockResolvedValue({ userId: "user-1", keyId: "key-1" });
  h.rateCheck.mockResolvedValue({ allowed: true, limit: 60, used: 1, reset: 60 });
  h.entitlementCheck.mockResolvedValue({ allowed: true });
});

describe("brief_product: guards", () => {
  it("returns 503 when the worker is unconfigured", async () => {
    delete process.env.PLINTH_EXTRACTOR_URL;
    expect((await post({ gtin: "1" }, AUTH)).status).toBe(503);
  });

  it("returns 401 without a valid key", async () => {
    h.validateApiKey.mockResolvedValue(null);
    expect((await post({ gtin: "1" })).status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    h.rateCheck.mockResolvedValue({ allowed: false, limit: 60, used: 61, reset: 5 });
    expect((await post({ gtin: "1" }, AUTH)).status).toBe(429);
  });

  it("returns 402 when quota is exhausted, without calling the worker", async () => {
    h.entitlementCheck.mockResolvedValue({ allowed: false, reason: "quota_exceeded" });
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await post({ gtin: "1" }, AUTH)).status).toBe(402);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    expect((await post("{bad", AUTH)).status).toBe(400);
  });
});

describe("brief_product: exactly one input", () => {
  it.each(["url", "gtin", "name"])("accepts %s on its own", async (key) => {
    stubWorker(TRUSTED);
    const res = await post({ [key]: key === "url" ? "https://a.com/p" : "value" }, AUTH);
    expect(res.status).toBe(200);
  });

  it("rejects none of the three", async () => {
    expect((await post({}, AUTH)).status).toBe(422);
  });

  it("rejects two of the three", async () => {
    expect((await post({ gtin: "1", name: "thing" }, AUTH)).status).toBe(422);
  });

  it("rejects all three", async () => {
    expect((await post({ url: "https://a.com/p", gtin: "1", name: "x" }, AUTH)).status).toBe(422);
  });

  it("treats an empty string as not provided", async () => {
    expect((await post({ gtin: "" }, AUTH)).status).toBe(422);
  });

  it("echoes back the single input that was used", async () => {
    stubWorker(TRUSTED);
    const body = await (await post({ gtin: "8076800195057" }, AUTH)).json();
    expect(body.input).toEqual({ gtin: "8076800195057" });
  });
});

describe("brief_product: the brief itself", () => {
  it("returns a brief alongside the typed product", async () => {
    stubWorker(TRUSTED);
    const body = await (await post({ gtin: "1" }, AUTH)).json();
    expect(body.brief).toContain("Wool Runner by Allbirds.");
    expect(body.brief).toContain("Overall confidence 0.92");
    expect(body.product.title).toBe("Wool Runner");
  });

  it("still returns a brief when nothing was found, rather than omitting the field", async () => {
    // An agent parsing the response must not have to handle a missing key on the sad path.
    stubWorker(JSON.stringify({ product: null, confidence: 0.1 }));
    const body = await (await post({ gtin: "1" }, AUTH)).json();
    expect(body.product).toBeNull();
    expect(body.brief).toBe("No confident product data was found for this query.");
  });

  it("defaults confidence to 0 and method to null on a bare envelope", async () => {
    stubWorker(JSON.stringify({ product: null }));
    const body = await (await post({ gtin: "1" }, AUTH)).json();
    expect(body.confidence).toBe(0);
    expect(body.method).toBeNull();
  });
});

describe("brief_product: metering", () => {
  it("meters the call under its own tool name", async () => {
    stubWorker(TRUSTED);
    await post({ gtin: "1" }, AUTH);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      tool: "brief_product",
      endpoint: "/api/v1/brief_product",
    });
  });

  it("still meters a null read", async () => {
    stubWorker(JSON.stringify({ product: null, confidence: 0.1 }));
    await post({ gtin: "1" }, AUTH);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({ billable: false });
  });
});
