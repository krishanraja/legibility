import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * resolve_product takes a fuzzy product name rather than an identifier. It is the only
 * tool whose input is free text, so the guard that matters is the minimum-length check:
 * a one-character query would fan out into a neural search that costs real money and
 * returns noise.
 *
 * It is also documented as synchronous. An earlier draft of the docs described a job id
 * and a polling endpoint that were never built, so the shape of the success response is
 * worth pinning down.
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
const ENVELOPE = JSON.stringify({
  product: { title: "Sony WH-1000XM5" },
  confidence: 0.88,
  cost_usd: 0.01,
});

function stubWorker(text: string, status = 200) {
  const calls: Array<{ body: string }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_u: string, init: { body: string }) => {
      calls.push({ body: init.body });
      return { status, text: async () => text } as Response;
    }),
  );
  return calls;
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  const mod = await import("./resolve_product");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  return handlers.POST({
    request: new Request("https://legibility.io/api/v1/resolve_product", {
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

describe("resolve_product: guards", () => {
  it("returns 503 when the worker is unconfigured", async () => {
    delete process.env.PLINTH_EXTRACTOR_URL;
    expect((await post({ name: "Sony WH-1000XM5" }, AUTH)).status).toBe(503);
  });

  it("returns 401 without a valid key", async () => {
    h.validateApiKey.mockResolvedValue(null);
    expect((await post({ name: "Sony WH-1000XM5" })).status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    h.rateCheck.mockResolvedValue({ allowed: false, limit: 60, used: 61, reset: 9 });
    expect((await post({ name: "Sony" }, AUTH)).status).toBe(429);
  });

  it("returns 402 on exhausted quota without calling the worker", async () => {
    h.entitlementCheck.mockResolvedValue({ allowed: false, reason: "quota_exceeded" });
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await post({ name: "Sony" }, AUTH)).status).toBe(402);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    expect((await post("{bad", AUTH)).status).toBe(400);
  });
});

describe("resolve_product: the free-text guard", () => {
  it("rejects a missing name", async () => {
    expect((await post({}, AUTH)).status).toBe(422);
  });

  it("rejects a non-string name", async () => {
    expect((await post({ name: 42 }, AUTH)).status).toBe(422);
  });

  it("rejects a single character, which would buy noise from a neural search", async () => {
    expect((await post({ name: "a" }, AUTH)).status).toBe(422);
  });

  it("rejects whitespace that only looks like a query", async () => {
    expect((await post({ name: "   " }, AUTH)).status).toBe(422);
  });

  it("accepts the two-character minimum", async () => {
    stubWorker(ENVELOPE);
    expect((await post({ name: "XM" }, AUTH)).status).toBe(200);
  });

  it("trims before forwarding, so padding cannot smuggle a short query through", async () => {
    const calls = stubWorker(ENVELOPE);
    await post({ name: "  Sony WH-1000XM5  " }, AUTH);
    expect(JSON.parse(calls[0].body).name).toBe("Sony WH-1000XM5");
  });

  it("does not call the worker for a rejected query", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await post({ name: "a" }, AUTH);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("resolve_product: response and metering", () => {
  it("returns the resolved product synchronously, with no job id", async () => {
    // The docs once described an async job id and a polling endpoint. Neither was built,
    // and this asserts the response is the answer itself.
    stubWorker(ENVELOPE);
    const body = await (await post({ name: "Sony WH-1000XM5" }, AUTH)).json();
    expect(body.product.title).toBe("Sony WH-1000XM5");
    expect(body).not.toHaveProperty("job_id");
    expect(body).not.toHaveProperty("id");
  });

  it("meters under its own tool name with the name: domain sentinel", async () => {
    stubWorker(ENVELOPE);
    await post({ name: "Sony WH-1000XM5" }, AUTH);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({ tool: "resolve_product", domain: "name:" });
  });

  it("meters a null resolve as non-billable", async () => {
    stubWorker(JSON.stringify({ product: null, confidence: 0.2 }));
    await post({ name: "something obscure" }, AUTH);
    expect(h.inserts[0]).toMatchObject({ billable: false });
  });

  it("returns 502 and still meters when the worker is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    const res = await post({ name: "Sony WH-1000XM5" }, AUTH);
    expect(res.status).toBe(502);
    expect(h.inserts).toHaveLength(1);
  });
});
