// PLAN F0.7 (+ MOAT wire-in): parse the worker envelope once and stamp every
// metered call with the fields that make it a calibration observation, not just
// a billable row: confidence, product_returned, domain, envelope_hash, request_id.
import { createHash } from "node:crypto";

export type EnvelopeStamp = {
  request_id: string | null;
  confidence: number | null;
  product_returned: boolean | null;
  billable: boolean;
  domain: string | null;
  envelope_hash: string;
  calibration_version: string | null;
  cost_usd: number;
  cached: boolean;
};

// P2.3 trusted-read billing unit: a call is billable only when it returned a trusted
// product (a real object AND confidence at or above the gate). Nulls and low-confidence
// reads charge nothing and do not count against the monthly quota.
const BILLABLE_GATE = 0.7;

type MeterInput = { url?: unknown; gtin?: unknown; name?: unknown };

export function stampFromResponse(text: string, input: MeterInput): EnvelopeStamp {
  let env: Record<string, unknown> | null = null;
  try {
    env = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-JSON upstream body; stamp what we can */
  }
  let domain: string | null = null;
  if (typeof input.url === "string") {
    try {
      domain = new URL(input.url).hostname;
    } catch {
      domain = null;
    }
  } else if (typeof input.gtin === "string") {
    domain = "gtin:";
  } else if (typeof input.name === "string") {
    domain = "name:";
  }
  const confidence = typeof env?.confidence === "number" ? env.confidence : null;
  const productReturned = env ? env.product != null : null;
  return {
    request_id: typeof env?.request_id === "string" ? env.request_id : null,
    confidence,
    product_returned: productReturned,
    billable: productReturned === true && (confidence ?? 0) >= BILLABLE_GATE,
    domain,
    envelope_hash: createHash("sha256").update(text).digest("hex"),
    calibration_version:
      typeof env?.calibration_version === "string" ? env.calibration_version : null,
    cost_usd: typeof env?.cost_usd === "number" ? env.cost_usd : 0,
    cached: Boolean(env?.cached),
  };
}
