// x402 (HTTP 402) settlement on Base Sepolia via a facilitator (Coinbase x402 v1 schema).
// Lets an autonomous agent pay per call in USDC instead of holding a lgk_ API key.

const FACILITATOR = process.env.X402_FACILITATOR ?? "https://x402.org/facilitator";
const NETWORK = process.env.X402_NETWORK ?? "base-sepolia";
// USDC on Base Sepolia (6 decimals).
const ASSET = process.env.X402_ASSET ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PRICE = process.env.X402_PRICE_ATOMIC ?? "10000"; // 0.01 USDC
const RECIPIENT = process.env.X402_RECIPIENT ?? "0x0000000000000000000000000000000000000000";

export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { name: string; version: string };
};

export function paymentRequirements(resource: string, description: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK,
    maxAmountRequired: PRICE,
    resource,
    description,
    mimeType: "application/json",
    payTo: RECIPIENT,
    maxTimeoutSeconds: 120,
    asset: ASSET,
    extra: { name: "USDC", version: "2" },
  };
}

// The HTTP 402 body an x402 client reads to discover how to pay.
export function quote402(resource: string, description: string, extra?: Record<string, unknown>) {
  return {
    x402Version: 1,
    error: "Payment required: provide a lgk_ API key (Bearer) or a settled X-PAYMENT header.",
    accepts: [paymentRequirements(resource, description)],
    ...(extra ?? {}),
  };
}

// Verify then settle an X-PAYMENT header against the facilitator. Returns the base64
// X-PAYMENT-RESPONSE on success (settlement proof, incl. the on-chain tx hash).
export async function settle(
  xPayment: string,
  reqs: PaymentRequirements,
): Promise<{ ok: boolean; settleHeader?: string; reason?: string }> {
  let paymentPayload: unknown;
  try {
    paymentPayload = JSON.parse(Buffer.from(xPayment, "base64").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed X-PAYMENT header" };
  }
  const body = JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: reqs });
  const headers = { "content-type": "application/json" };

  let verify: { isValid?: boolean; invalidReason?: string } | null = null;
  try {
    verify = await (
      await fetch(`${FACILITATOR}/verify`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(15000),
      })
    ).json();
  } catch {
    return { ok: false, reason: "facilitator verify unreachable" };
  }
  if (!verify?.isValid) return { ok: false, reason: verify?.invalidReason ?? "payment not valid" };

  let settled: { success?: boolean; errorReason?: string } | null = null;
  try {
    settled = await (
      await fetch(`${FACILITATOR}/settle`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(30000),
      })
    ).json();
  } catch {
    return { ok: false, reason: "facilitator settle unreachable" };
  }
  if (!settled?.success) return { ok: false, reason: settled?.errorReason ?? "settlement failed" };

  return { ok: true, settleHeader: Buffer.from(JSON.stringify(settled)).toString("base64") };
}
