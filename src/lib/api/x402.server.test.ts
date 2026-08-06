import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentRequirements, quote402, settle } from "./x402.server";

/**
 * x402 is how an agent pays per call without holding a key. `settle` talks to an external
 * facilitator over the network, so every branch here is about what happens when that
 * facilitator misbehaves: unreachable, invalid, or refusing to settle. Getting any of
 * those wrong means either giving away a paid call or rejecting a valid payment.
 */

const REQS = paymentRequirements("https://legibility.io/api/mcp", "read_product");

/** Build a base64 X-PAYMENT header the way a real client would. */
function xPayment(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/** Stub global fetch with a queue of JSON responses, one per call. */
function stubFetch(...responses: Array<unknown | Error>) {
  const calls: Array<{ url: string; body: unknown }> = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      const r = responses[i++];
      if (r instanceof Error) throw r;
      return { json: async () => r } as Response;
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("paymentRequirements", () => {
  it("returns the exact-scheme shape an x402 client expects", () => {
    expect(REQS).toMatchObject({
      scheme: "exact",
      mimeType: "application/json",
      maxTimeoutSeconds: 120,
      extra: { name: "USDC", version: "2" },
    });
  });

  it("carries the resource and description through", () => {
    const r = paymentRequirements("https://example.com/x", "a description");
    expect(r.resource).toBe("https://example.com/x");
    expect(r.description).toBe("a description");
  });

  it("defaults to Base Sepolia testnet, never mainnet", () => {
    // Guards the kill-criteria decision to stay on testnet during beta. If this ever
    // reads "base", settlement is live and that must be a deliberate change.
    expect(REQS.network).toBe("base-sepolia");
  });

  it("defaults the price to 0.01 USDC in atomic units", () => {
    expect(REQS.maxAmountRequired).toBe("10000");
  });
});

describe("quote402", () => {
  it("wraps the requirements in the discovery envelope", () => {
    const q = quote402("res", "desc");
    expect(q.x402Version).toBe(1);
    expect(q.accepts).toHaveLength(1);
    expect(q.accepts[0].resource).toBe("res");
  });

  it("mentions both payment routes in the error string", () => {
    // An agent reads this to work out how to proceed, so it must name the key path too.
    expect(quote402("r", "d").error).toContain("lgk_");
    expect(quote402("r", "d").error).toContain("X-PAYMENT");
  });

  it("merges extra fields without clobbering the envelope", () => {
    const q = quote402("r", "d", { hint: "top up" }) as Record<string, unknown>;
    expect(q.hint).toBe("top up");
    expect(q.x402Version).toBe(1);
  });
});

describe("settle", () => {
  it("rejects a header that is not valid base64 JSON", async () => {
    const res = await settle("!!!not-base64!!!", REQS);
    expect(res).toEqual({ ok: false, reason: "malformed X-PAYMENT header" });
  });

  it("rejects an empty header without calling the facilitator", async () => {
    const calls = stubFetch();
    const res = await settle("", REQS);
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("returns the facilitator's reason when the payment is invalid", async () => {
    stubFetch({ isValid: false, invalidReason: "insufficient_balance" });
    const res = await settle(xPayment({ sig: "0xabc" }), REQS);
    expect(res).toEqual({ ok: false, reason: "insufficient_balance" });
  });

  it("falls back to a generic reason when the facilitator gives none", async () => {
    stubFetch({ isValid: false });
    expect((await settle(xPayment({}), REQS)).reason).toBe("payment not valid");
  });

  it("does not attempt settlement when verification fails", async () => {
    const calls = stubFetch({ isValid: false, invalidReason: "nope" });
    await settle(xPayment({}), REQS);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/verify");
  });

  it("reports an unreachable verify endpoint rather than throwing", async () => {
    stubFetch(new Error("network down"));
    expect(await settle(xPayment({}), REQS)).toEqual({
      ok: false,
      reason: "facilitator verify unreachable",
    });
  });

  it("reports an unreachable settle endpoint rather than throwing", async () => {
    stubFetch({ isValid: true }, new Error("network down"));
    expect(await settle(xPayment({}), REQS)).toEqual({
      ok: false,
      reason: "facilitator settle unreachable",
    });
  });

  it("returns the facilitator's reason when settlement itself fails", async () => {
    stubFetch({ isValid: true }, { success: false, errorReason: "tx_reverted" });
    expect(await settle(xPayment({}), REQS)).toEqual({ ok: false, reason: "tx_reverted" });
  });

  it("falls back to a generic reason when settlement gives none", async () => {
    stubFetch({ isValid: true }, { success: false });
    expect((await settle(xPayment({}), REQS)).reason).toBe("settlement failed");
  });

  it("returns a base64 settlement proof on success", async () => {
    const proof = { success: true, transaction: "0xdeadbeef", network: "base-sepolia" };
    stubFetch({ isValid: true }, proof);
    const res = await settle(xPayment({ sig: "0xabc" }), REQS);
    expect(res.ok).toBe(true);
    expect(JSON.parse(Buffer.from(res.settleHeader!, "base64").toString("utf8"))).toEqual(proof);
  });

  it("sends the same x402Version and requirements to both endpoints", async () => {
    const calls = stubFetch({ isValid: true }, { success: true });
    await settle(xPayment({ sig: "0x1" }), REQS);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/verify");
    expect(calls[1].url).toContain("/settle");
    for (const c of calls) {
      expect(c.body).toMatchObject({ x402Version: 1, paymentRequirements: REQS });
    }
  });

  it("forwards the decoded payment payload, not the raw header", async () => {
    const calls = stubFetch({ isValid: true }, { success: true });
    await settle(xPayment({ sig: "0xfeed", from: "0xabc" }), REQS);
    expect((calls[0].body as { paymentPayload: unknown }).paymentPayload).toEqual({
      sig: "0xfeed",
      from: "0xabc",
    });
  });
});
