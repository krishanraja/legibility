import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * compare_products fans out one call into N worker requests and folds the results into a
 * price comparison. Two things make it distinct from the single-read routes.
 *
 * It must degrade partially: one dead URL out of five should yield four good rows and one
 * null row, never a failed request. And its price_delta is arithmetic over untrusted
 * upstream data, so the interesting cases are the ones where prices are missing, partial,
 * or all identical.
 *
 * It also meters ONCE for N upstream calls, which is a deliberate approximation worth
 * pinning down so nobody "corrects" it into N rows and inflates the billing unit.
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

/** Build an envelope for a given url with an optional price low. */
function env(url: string, low: number | null, over: Record<string, unknown> = {}) {
  return {
    input: { url },
    product:
      low === null
        ? { title: `T ${url}`, price: null }
        : { title: `T ${url}`, price: { low, high: low, currency: "USD", n_sources: 1 } },
    confidence: 0.9,
    cost_usd: 0.004,
    cached: false,
    ...over,
  };
}

/** Respond per-URL from a map; a url mapped to `null` throws, simulating a dead upstream. */
function stubPerUrl(map: Record<string, unknown | null>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_u: string, init: { body: string }) => {
      const { url } = JSON.parse(init.body);
      const val = map[url];
      if (val === null) throw new Error("upstream dead");
      return { status: 200, json: async () => val } as unknown as Response;
    }),
  );
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  const mod = await import("./compare_products");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  return handlers.POST({
    request: new Request("https://legibility.io/api/v1/compare_products", {
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

const A = "https://a.com/p";
const B = "https://b.com/p";

describe("compare_products: guards", () => {
  it("returns 503 when the worker is unconfigured", async () => {
    delete process.env.PLINTH_EXTRACTOR_URL;
    expect((await post({ urls: [A, B] }, AUTH)).status).toBe(503);
  });

  it("returns 401 without a valid key", async () => {
    h.validateApiKey.mockResolvedValue(null);
    expect((await post({ urls: [A, B] })).status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    expect((await post("{bad", AUTH)).status).toBe(400);
  });

  it("rejects fewer than two urls", async () => {
    expect((await post({ urls: [A] }, AUTH)).status).toBe(422);
  });

  it("rejects more than five urls, which bounds the fan-out cost", async () => {
    const many = Array.from({ length: 6 }, (_, i) => `https://x${i}.com/p`);
    expect((await post({ urls: many }, AUTH)).status).toBe(422);
  });

  it("rejects a non-array urls field", async () => {
    expect((await post({ urls: A }, AUTH)).status).toBe(422);
  });

  it("blocks on quota before fanning out", async () => {
    h.entitlementCheck.mockResolvedValue({ allowed: false, reason: "quota_exceeded" });
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await post({ urls: [A, B] }, AUTH)).status).toBe(402);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("compare_products: fan-out and partial failure", () => {
  it("calls the worker once per url", async () => {
    stubPerUrl({ [A]: env(A, 100), [B]: env(B, 120) });
    await post({ urls: [A, B] }, AUTH);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(
      2,
    );
  });

  it("degrades partially: a dead upstream becomes a null row, not a failed request", async () => {
    stubPerUrl({ [A]: env(A, 100), [B]: null });
    const res = await post({ urls: [A, B] }, AUTH);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[1].title).toBeNull();
    expect(body.items[1].confidence).toBe(0);
  });

  it("still returns 200 when every upstream call fails", async () => {
    stubPerUrl({ [A]: null, [B]: null });
    const res = await post({ urls: [A, B] }, AUTH);
    expect(res.status).toBe(200);
    expect((await res.json()).price_delta).toBeNull();
  });
});

describe("compare_products: price_delta arithmetic", () => {
  it("computes min, max and spread across the low prices", async () => {
    stubPerUrl({ [A]: env(A, 98.5), [B]: env(B, 120) });
    const body = await (await post({ urls: [A, B] }, AUTH)).json();
    expect(body.price_delta).toMatchObject({ min: 98.5, max: 120, spread: 21.5, currency: "USD" });
  });

  it("returns a zero spread when prices are identical", async () => {
    stubPerUrl({ [A]: env(A, 100), [B]: env(B, 100) });
    expect((await (await post({ urls: [A, B] }, AUTH)).json()).price_delta.spread).toBe(0);
  });

  it("is null when no item carries a price", async () => {
    stubPerUrl({ [A]: env(A, null), [B]: env(B, null) });
    expect((await (await post({ urls: [A, B] }, AUTH)).json()).price_delta).toBeNull();
  });

  it("computes over the priced items only when some lack a price", async () => {
    stubPerUrl({ [A]: env(A, 100), [B]: env(B, null) });
    const d = (await (await post({ urls: [A, B] }, AUTH)).json()).price_delta;
    expect(d).toMatchObject({ min: 100, max: 100, spread: 0 });
  });

  it("rounds the spread to two decimals rather than leaking float noise", async () => {
    // 120.3 - 98.1 is 22.199999999999996 in IEEE 754. Returning that would look broken.
    stubPerUrl({ [A]: env(A, 98.1), [B]: env(B, 120.3) });
    expect((await (await post({ urls: [A, B] }, AUTH)).json()).price_delta.spread).toBe(22.2);
  });
});

describe("compare_products: cost and metering", () => {
  it("sums cost across every upstream call", async () => {
    stubPerUrl({ [A]: env(A, 100), [B]: env(B, 120) });
    expect((await (await post({ urls: [A, B] }, AUTH)).json()).cost_usd).toBeCloseTo(0.008, 6);
  });

  it("reports cached when ANY upstream response was cached", async () => {
    stubPerUrl({ [A]: env(A, 100, { cached: true }), [B]: env(B, 120) });
    expect((await (await post({ urls: [A, B] }, AUTH)).json()).cached).toBe(true);
  });

  it("writes exactly ONE usage row for an N-url comparison", async () => {
    // Deliberate: the billing unit is the call, not the fan-out. Changing this to N rows
    // would silently multiply what a comparison costs a customer.
    stubPerUrl({ [A]: env(A, 100), [B]: env(B, 120) });
    await post({ urls: [A, B] }, AUTH);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({ tool: "compare_products" });
  });

  it("echoes the requested urls back in the response", async () => {
    stubPerUrl({ [A]: env(A, 100), [B]: env(B, 120) });
    expect((await (await post({ urls: [A, B] }, AUTH)).json()).input.urls).toEqual([A, B]);
  });
});
