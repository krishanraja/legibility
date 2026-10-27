// A5: one row per x402 payment (supabase/migrations/20261027160000_x402_settlements.sql).
//
// A payment is known by its own id: the EIP-3009 authorization nonce the payer signed, which
// is unique per payment and identical on a retry of the same payment. Its hash is the row key,
// so a retried payment never writes a second row. When a payload carries no nonce, the hash of
// the X-PAYMENT header stands in (a retry resends the same header). Never stored: the header,
// the payload, a wallet address or a transaction hash.
import { createHash } from "node:crypto";

import type { PaymentRequirements } from "@/lib/api/x402.server";

/**
 * The USDC to USD rate the rows record, with its date. USDC is a dollar stablecoin and this
 * is its peg, not a market price; change both together if a market rate is ever used.
 */
export const USDC_USD = { rate: 1, as_of: "2026-10-27" } as const;
const USDC_DECIMALS = 6;

const NONCE = /^0x[0-9a-fA-F]{64}$/;
const ATOMIC = /^\d{1,30}$/;

export type PaymentFacts = { paymentId: string; amountAtomic: string };

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** The payment's id and amount from its X-PAYMENT header, or null when it is not one. */
export function paymentFacts(xPayment: string, reqs: PaymentRequirements): PaymentFacts | null {
  let payload: { payload?: { authorization?: { nonce?: unknown; value?: unknown } } };
  try {
    payload = JSON.parse(Buffer.from(xPayment, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const auth = payload.payload?.authorization;
  const nonce = typeof auth?.nonce === "string" && NONCE.test(auth.nonce) ? auth.nonce : null;
  const value = typeof auth?.value === "string" && ATOMIC.test(auth.value) ? auth.value : null;
  return {
    paymentId: nonce
      ? sha256(`nonce:${reqs.network}:${reqs.asset.toLowerCase()}:${nonce.toLowerCase()}`)
      : sha256(`header:${xPayment.trim()}`),
    amountAtomic: value ?? reqs.maxAmountRequired,
  };
}

/**
 * The ledger's network. Base mainnet only when the payment was asked for on Base mainnet
 * ("base"); testnet stays testnet; anything else is not recorded at all.
 */
export function ledgerNetwork(network: string): "base-sepolia" | "base-mainnet" | null {
  if (network === "base-sepolia") return "base-sepolia";
  if (network === "base") return "base-mainnet";
  return null;
}

export function amountUsd(atomic: string): number {
  return (Number(atomic) / 10 ** USDC_DECIMALS) * USDC_USD.rate;
}

export type SettlementOutcome = { ok: boolean; reason?: string };

/** The ledger write for one payment attempt, or null when there is nothing to record. */
export function settlementRow(
  xPayment: string,
  reqs: PaymentRequirements,
  outcome: SettlementOutcome,
  tool: string,
) {
  const facts = paymentFacts(xPayment, reqs);
  const network = ledgerNetwork(reqs.network);
  if (!facts || !network) return null;
  return {
    _payment_id: facts.paymentId,
    _network: network,
    _status: outcome.ok ? "settled" : "failed",
    _amount_usd: amountUsd(facts.amountAtomic),
    _usd_rate: USDC_USD.rate,
    _rate_as_of: USDC_USD.as_of,
    _tool: /^[a-z_]{1,40}$/.test(tool) ? tool : null,
    _failure_reason: outcome.ok ? null : (outcome.reason ?? "failed").slice(0, 200),
  };
}

/** Record an attempt. Best-effort: a ledger failure never changes what the caller gets. */
export async function recordSettlement(
  xPayment: string,
  reqs: PaymentRequirements,
  outcome: SettlementOutcome,
  tool: string,
): Promise<void> {
  const row = settlementRow(xPayment, reqs, outcome, tool);
  if (!row) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("record_x402_settlement", row);
    if (error) console.error("[x402] settlement not recorded", error.code);
  } catch {
    /* ledger best-effort */
  }
}
