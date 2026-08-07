import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route integration tests for the full read_product chain.
 *
 * No msw. Every boundary this route touches is reached through a dynamic `await import`,
 * so vitest's own module mocking covers it, and `fetch` is stubbed directly. The point of
 * these tests is the ORDER and the FAIL-CLOSED behaviour: auth before rate limit, rate
 * limit before quota, quota before the worker call (so a free account cannot run unbounded
 * real-cost extractions), and a metered row written whatever happens.
 */

const h = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  rateCheck: vi.fn(),
  entitlementCheck: vi.fn(),
  inserts: [] as Record<string, unknown>[],
  keyUpdates: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/api-keys.server", () => ({
  validateApiKey: h.validateApiKey,
}));

vi.mock("@/integrations/supabase/rate-limit.server", () => ({
  rateCheck: h.rateCheck,
  rateHeaders: (rl: { limit: number; used: number; reset: number }) => ({
    "x-ratelimit-limit": String(rl.limit),
    "x-ratelimit-remaining": String(Math.max(0, rl.limit - rl.used)),
  }),
}));

vi.mock("@/integrations/supabase/entitlement.server", () => ({
  entitlementCheck: h.entitlementCheck,
  quotaBlockedBody: (ent: { reason: string }, url: string) => ({
    error: "quota_exceeded",
    reason: ent.reason,
    upgrade_url: url,
  }),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === "usage_events") h.inserts.push(row);
        return Promise.resolve({ error: null });
      },
      update: (row: Record<string, unknown>) => ({
        eq: () => {
          if (table === "api_keys") h.keyUpdates.push(row);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

const PRINCIPAL = { userId: "user-1", keyId: "key-1" };
const ALLOWED_RL = { allowed: true, limit: 60, used: 1, reset: 60 };

/** A trusted worker envelope. */
function envelope(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    request_id: "req_1",
    product: { name: "Wool Runner" },
    confidence: 0.93,
    calibration_version: "iso-63",
    cost_usd: 0.004,
    cached: false,
    ...over,
  });
}

function stubWorker(bodyText: string, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { status, text: async () => bodyText } as Response;
    }),
  );
  return calls;
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  const mod = await import("./read_product");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  const request = new Request("https://legibility.io/api/v1/read_product", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return handlers.POST({ request });
}

const AUTH = { authorization: "Bearer lgk_valid" };

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;
  h.keyUpdates.length = 0;
  process.env.PLINTH_EXTRACTOR_URL = "https://legibility-worker.vercel.app/extract";
  process.env.PLINTH_EXTRACTOR_TOKEN = "worker-token-for-tests";
  h.validateApiKey.mockResolvedValue(PRINCIPAL);
  h.rateCheck.mockResolvedValue(ALLOWED_RL);
  h.entitlementCheck.mockResolvedValue({ allowed: true });
});

afterEach(() => vi.unstubAllGlobals());

describe("read_product: configuration and auth", () => {
  it("returns 503 when the worker is not configured, before touching auth", async () => {
    delete process.env.PLINTH_EXTRACTOR_URL;
    const res = await post({ gtin: "8076800195057" }, AUTH);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("external_worker_not_configured");
    expect(h.validateApiKey).not.toHaveBeenCalled();
  });

  it("returns 503 when the worker token is missing", async () => {
    delete process.env.PLINTH_EXTRACTOR_TOKEN;
    expect((await post({ gtin: "1" }, AUTH)).status).toBe(503);
  });

  it("returns 401 with no authorization header", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const res = await post({ gtin: "1" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("returns 401 for a rejected key", async () => {
    h.validateApiKey.mockResolvedValue(null);
    expect((await post({ gtin: "1" }, { authorization: "Bearer lgk_bad" })).status).toBe(401);
  });

  it("only forwards the token part of the Bearer header", async () => {
    h.validateApiKey.mockResolvedValue(null);
    await post({ gtin: "1" }, { authorization: "Bearer   lgk_padded  " });
    expect(h.validateApiKey).toHaveBeenCalledWith("lgk_padded");
  });

  it("treats a non-Bearer scheme as no credential", async () => {
    h.validateApiKey.mockResolvedValue(null);
    await post({ gtin: "1" }, { authorization: "Basic abc" });
    expect(h.validateApiKey).toHaveBeenCalledWith(null);
  });

  it("does not call the worker when auth fails", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const calls = stubWorker(envelope());
    await post({ gtin: "1" });
    expect(calls).toHaveLength(0);
  });
});

describe("read_product: rate limit and quota", () => {
  it("returns 429 with retry-after when rate limited", async () => {
    h.rateCheck.mockResolvedValue({ allowed: false, limit: 60, used: 61, reset: 42 });
    const res = await post({ gtin: "1" }, AUTH);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("returns 402 when the plan quota is exhausted", async () => {
    h.entitlementCheck.mockResolvedValue({ allowed: false, reason: "quota_exceeded" });
    const res = await post({ gtin: "1" }, AUTH);
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe("quota_exceeded");
  });

  it("blocks on quota BEFORE calling the worker, so a free account cannot run up real cost", async () => {
    h.entitlementCheck.mockResolvedValue({ allowed: false, reason: "quota_exceeded" });
    const calls = stubWorker(envelope());
    await post({ gtin: "1" }, AUTH);
    expect(calls).toHaveLength(0);
  });

  it("checks rate limit before quota", async () => {
    h.rateCheck.mockResolvedValue({ allowed: false, limit: 60, used: 61, reset: 1 });
    await post({ gtin: "1" }, AUTH);
    expect(h.entitlementCheck).not.toHaveBeenCalled();
  });
});

describe("read_product: input validation", () => {
  it("returns 400 on a malformed JSON body", async () => {
    const res = await post("{not json", AUTH);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_json");
  });

  it("returns 422 when neither url nor gtin is supplied", async () => {
    const res = await post({}, AUTH);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_request");
  });

  it("returns 422 when BOTH url and gtin are supplied", async () => {
    expect((await post({ url: "https://x.com/p", gtin: "1" }, AUTH)).status).toBe(422);
  });

  it("returns 422 for an empty string, which is not a usable input", async () => {
    expect((await post({ gtin: "" }, AUTH)).status).toBe(422);
  });

  it("forwards min_confidence only when it is a number", async () => {
    const calls = stubWorker(envelope());
    await post({ gtin: "1", min_confidence: 0.9 }, AUTH);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ gtin: "1", min_confidence: 0.9 });

    stubWorker(envelope());
    const calls2 = stubWorker(envelope());
    await post({ gtin: "1", min_confidence: "0.9" }, AUTH);
    expect(JSON.parse(calls2[0].init.body as string)).toEqual({ gtin: "1" });
  });

  it("sends the worker bearer token, never the caller's key", async () => {
    const calls = stubWorker(envelope());
    await post({ gtin: "1" }, AUTH);
    const sent = calls[0].init.headers as Record<string, string>;
    expect(sent.authorization).toBe("Bearer worker-token-for-tests");
    expect(JSON.stringify(sent)).not.toContain("lgk_valid");
  });
});

describe("read_product: metering", () => {
  it("writes a billable row for a trusted read", async () => {
    stubWorker(envelope({ confidence: 0.93 }));
    const res = await post({ url: "https://www.allbirds.com/products/x" }, AUTH);
    expect(res.status).toBe(200);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      user_id: "user-1",
      api_key_id: "key-1",
      tool: "read_product",
      endpoint: "/api/v1/read_product",
      billable: true,
      product_returned: true,
      domain: "www.allbirds.com",
    });
  });

  it("STILL writes a row for a null read, with billable false", async () => {
    // This is the behaviour the whole panel thesis depends on: a failed read is an
    // observation we keep, not an event we discard.
    stubWorker(envelope({ product: null, confidence: 0.2 }));
    await post({ url: "https://www.lego.com/x" }, AUTH);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      billable: false,
      product_returned: false,
      domain: "www.lego.com",
    });
  });

  it("writes a row even when the worker is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection reset");
      }),
    );
    const res = await post({ gtin: "1" }, AUTH);
    expect(res.status).toBe(502);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({ status: 502, billable: false });
  });

  it("does not bill a below-gate read even though a product came back", async () => {
    stubWorker(envelope({ confidence: 0.69 }));
    await post({ gtin: "1" }, AUTH);
    expect(h.inserts[0]).toMatchObject({ product_returned: true, billable: false });
  });

  it("touches last_used_at on the key alongside the meter row", async () => {
    stubWorker(envelope());
    await post({ gtin: "1" }, AUTH);
    expect(h.keyUpdates).toHaveLength(1);
    expect(typeof h.keyUpdates[0].last_used_at).toBe("string");
  });

  it("still returns the worker body when metering throws", async () => {
    // Metering is best-effort by design: a telemetry failure must not fail a paid call.
    stubWorker(envelope());
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    vi.spyOn(supabaseAdmin, "from").mockImplementation(() => {
      throw new Error("db down");
    });
    const res = await post({ gtin: "1" }, AUTH);
    expect(res.status).toBe(200);
    expect((await res.json()).product).toEqual({ name: "Wool Runner" });
    vi.restoreAllMocks();
  });

  it("passes the worker status through rather than flattening it to 200", async () => {
    stubWorker(JSON.stringify({ error: "bad_input" }), 422);
    const res = await post({ gtin: "1" }, AUTH);
    expect(res.status).toBe(422);
  });

  it("returns rate-limit headers on a success", async () => {
    stubWorker(envelope());
    const res = await post({ gtin: "1" }, AUTH);
    expect(res.headers.get("x-ratelimit-limit")).toBe("60");
    expect(res.headers.get("content-type")).toBe("application/json");
  });
});
