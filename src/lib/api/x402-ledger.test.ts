import { beforeEach, describe, expect, it, vi } from "vitest";

/** A5: the x402 ledger's rules. Every value is synthetic: an invented nonce and amounts. */

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: h.rpc } }));

const { paymentRequirements } = await import("./x402.server");
const { USDC_USD, amountUsd, ledgerNetwork, paymentFacts, recordSettlement, settlementRow } =
  await import("./x402-ledger");

const REQS = paymentRequirements("https://legibility.io/api/mcp", "Legibility read_product");
const NONCE = `0x${"ab".repeat(32)}`;
const header = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64");
const PAID = header({
  x402Version: 1,
  scheme: "exact",
  network: "base-sepolia",
  payload: { signature: "0xsig", authorization: { nonce: NONCE, value: "10000" } },
});

beforeEach(() => {
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: null, error: null });
});

describe("paymentFacts", () => {
  it("keys a payment by a hash of its nonce, the same on a retry and never the nonce itself", () => {
    const a = paymentFacts(PAID, REQS);
    expect(a?.paymentId).toMatch(/^[0-9a-f]{64}$/);
    expect(a?.paymentId).not.toContain("abab");
    // A retry of the same payment, even re-encoded with different field order, is the same id.
    const reencoded = header({
      payload: {
        authorization: { value: "10000", nonce: NONCE.toUpperCase().replace("0X", "0x") },
      },
    });
    expect(paymentFacts(reencoded, REQS)?.paymentId).toBe(a?.paymentId);
    expect(a?.amountAtomic).toBe("10000");
  });

  it("falls back to the header's hash with no nonce, and to the asked price with no value", () => {
    const f = paymentFacts(header({ payload: {} }), REQS);
    expect(f?.paymentId).toMatch(/^[0-9a-f]{64}$/);
    expect(f?.amountAtomic).toBe(REQS.maxAmountRequired);
    expect(
      paymentFacts(header({ payload: { authorization: { nonce: "0x12", value: "1e9" } } }), REQS)
        ?.amountAtomic,
    ).toBe(REQS.maxAmountRequired);
  });

  it("is nothing for a header that is not a payment", () => {
    expect(paymentFacts("%%%not base64 json", REQS)).toBeNull();
    expect(paymentFacts(Buffer.from("null").toString("base64"), REQS)).toBeNull();
  });
});

describe("network and amount", () => {
  it("testnet stays testnet; mainnet only for Base mainnet; anything else is not recorded", () => {
    expect(ledgerNetwork("base-sepolia")).toBe("base-sepolia");
    expect(ledgerNetwork("base")).toBe("base-mainnet");
    expect(ledgerNetwork("ethereum")).toBeNull();
  });

  it("converts atomic USDC with the dated rate", () => {
    expect(amountUsd("10000")).toBe(0.01);
    expect(USDC_USD).toEqual({ rate: 1, as_of: "2026-10-27" });
  });
});

describe("settlementRow", () => {
  it("one call on Base Sepolia is one settled agent row with no wallet address", () => {
    const row = settlementRow(PAID, REQS, { ok: true }, "read_product");
    expect(row).toMatchObject({
      _network: "base-sepolia",
      _status: "settled",
      _amount_usd: 0.01,
      _usd_rate: 1,
      _rate_as_of: "2026-10-27",
      _tool: "read_product",
      _failure_reason: null,
    });
    expect(JSON.stringify(row)).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });

  it("a failed payment is a failed row with its reason", () => {
    expect(
      settlementRow(PAID, REQS, { ok: false, reason: "insufficient_balance" }, "x"),
    ).toMatchObject({
      _status: "failed",
      _failure_reason: "insufficient_balance",
    });
    expect(settlementRow(PAID, REQS, { ok: false }, "Bad Tool")).toMatchObject({
      _failure_reason: "failed",
      _tool: null,
    });
  });

  it("records nothing for a non-payment or an unknown network", () => {
    expect(settlementRow("%%%", REQS, { ok: false }, "x")).toBeNull();
    expect(settlementRow(PAID, { ...REQS, network: "polygon" }, { ok: true }, "x")).toBeNull();
  });
});

describe("recordSettlement", () => {
  it("writes the row through the idempotent function", async () => {
    await recordSettlement(PAID, REQS, { ok: true }, "read_product");
    expect(h.rpc).toHaveBeenCalledWith(
      "record_x402_settlement",
      expect.objectContaining({ _status: "settled" }),
    );
  });

  it("writes nothing for a non-payment, and never throws", async () => {
    await recordSettlement("%%%", REQS, { ok: false }, "x");
    expect(h.rpc).not.toHaveBeenCalled();
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    await expect(recordSettlement(PAID, REQS, { ok: true }, "x")).resolves.toBeUndefined();
    h.rpc.mockRejectedValueOnce(new Error("down"));
    await expect(recordSettlement(PAID, REQS, { ok: true }, "x")).resolves.toBeUndefined();
  });
});
