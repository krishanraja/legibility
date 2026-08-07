import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * report_outcome is the outcome-closure channel: an agent tells us whether a Legibility
 * answer led to a real buy at the stated price. docs/KILL-CRITERIA.md treats this as the
 * moat, because it is the only signal that connects a confidence score to reality.
 *
 * So the properties that matter are: it cannot be written anonymously, it cannot be
 * written unlinked to a read, and a database failure is reported rather than swallowed
 * (unlike metering, where best-effort is the right call, here the row IS the product).
 */

const h = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  inserts: [] as Record<string, unknown>[],
  insertError: null as { message: string } | null,
}));

vi.mock("@/integrations/supabase/api-keys.server", () => ({
  validateApiKey: h.validateApiKey,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        h.inserts.push(row);
        return Promise.resolve({ error: h.insertError });
      },
    }),
  },
}));

const AUTH = { authorization: "Bearer lgk_valid" };
const LINKED = { outcome: "purchased", request_id: "req_1" };

async function post(body: unknown, headers: Record<string, string> = {}) {
  const mod = await import("./report_outcome");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into the route object */
  const handlers = (mod.Route as any).options.server.handlers;
  return handlers.POST({
    request: new Request("https://legibility.io/api/v1/report_outcome", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;
  h.insertError = null;
  h.validateApiKey.mockResolvedValue({ userId: "user-1", keyId: "key-1" });
});

describe("report_outcome: identity", () => {
  it("rejects an unauthenticated report", async () => {
    h.validateApiKey.mockResolvedValue(null);
    const res = await post(LINKED);
    expect(res.status).toBe(401);
    expect(h.inserts).toHaveLength(0);
  });

  it("attributes the row to the authenticated user, not to anything in the body", async () => {
    // An agent must not be able to file outcomes against someone else's account.
    await post({ ...LINKED, user_id: "someone-else" }, AUTH);
    expect(h.inserts[0].user_id).toBe("user-1");
  });
});

describe("report_outcome: validation", () => {
  it("returns 400 on malformed JSON", async () => {
    expect((await post("{nope", AUTH)).status).toBe(400);
  });

  it.each([
    "purchased",
    "price_matched",
    "price_mismatch",
    "out_of_stock",
    "wrong_product",
    "other",
  ])("accepts the documented outcome %s", async (outcome) => {
    const res = await post({ outcome, request_id: "r" }, AUTH);
    expect(res.status).toBe(202);
  });

  it("rejects an outcome outside the enum", async () => {
    const res = await post({ outcome: "refunded", request_id: "r" }, AUTH);
    expect(res.status).toBe(422);
    expect(h.inserts).toHaveLength(0);
  });

  it("rejects a missing outcome", async () => {
    expect((await post({ request_id: "r" }, AUTH)).status).toBe(422);
  });

  it("rejects a non-string outcome", async () => {
    expect((await post({ outcome: 1, request_id: "r" }, AUTH)).status).toBe(422);
  });

  it("rejects a report that links to no read at all", async () => {
    // An unlinked outcome is unusable: it cannot be joined back to a confidence score.
    const res = await post({ outcome: "purchased" }, AUTH);
    expect(res.status).toBe(422);
    expect(h.inserts).toHaveLength(0);
  });

  it("accepts a link by legibility_id instead of request_id", async () => {
    const res = await post({ outcome: "purchased", legibility_id: "lg_1" }, AUTH);
    expect(res.status).toBe(202);
    expect(h.inserts[0]).toMatchObject({ legibility_id: "lg_1", request_id: null });
  });
});

describe("report_outcome: field handling", () => {
  it("records observed price and currency when supplied", async () => {
    await post({ ...LINKED, observed_price: 99.5, observed_currency: "USD" }, AUTH);
    expect(h.inserts[0]).toMatchObject({ observed_price: 99.5, observed_currency: "USD" });
  });

  it("nulls a non-numeric observed_price rather than storing a string", async () => {
    await post({ ...LINKED, observed_price: "99.5" }, AUTH);
    expect(h.inserts[0].observed_price).toBeNull();
  });

  it("truncates a long note to 500 characters", async () => {
    await post({ ...LINKED, note: "x".repeat(900) }, AUTH);
    expect((h.inserts[0].note as string).length).toBe(500);
  });

  it("keeps a short note intact", async () => {
    await post({ ...LINKED, note: "price was 5 higher" }, AUTH);
    expect(h.inserts[0].note).toBe("price was 5 higher");
  });
});

describe("report_outcome: failure handling", () => {
  it("reports a database failure rather than silently accepting", async () => {
    // Deliberately unlike metering. Here the row IS the deliverable, so a lost write must
    // surface to the caller, who can retry.
    h.insertError = { message: "connection lost" };
    const res = await post(LINKED, AUTH);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("insert_failed");
  });

  it("returns 202, not 200, on success", async () => {
    // 202 is honest: the report is accepted for processing, not acted on synchronously.
    const res = await post(LINKED, AUTH);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ received: true });
  });
});
