import { createFileRoute } from "@tanstack/react-router";

// MCP server (JSON-RPC 2.0 over HTTP POST). Discovery (initialize / tools/list / ping) is free.
// tools/call requires EITHER a valid lgk_ API key (Bearer) OR a settled x402 payment
// (X-PAYMENT header, verified + settled on Base Sepolia via a facilitator). Keyed calls are
// rate-limited and metered; x402 calls are paid on-chain so they skip account metering.

const PROTOCOL = "2025-06-18";

const TOOLS = [
  {
    name: "read_product",
    description:
      "Resolve a product URL or GTIN into a typed Schema.org Product object with per-field and overall confidence, a price band, source method, and the per-call cost.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Product page URL" },
        gtin: { type: "string", description: "GTIN / UPC / EAN barcode" },
        min_confidence: { type: "number", description: "Override the 0.7 trust gate (0 to 1)" },
      },
    },
  },
  {
    name: "resolve_product",
    description:
      "Resolve a fuzzy product name into a typed product object (neural search then extraction). Returns the resolved product and its source URL.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Fuzzy product name" },
        min_confidence: { type: "number", description: "Override the 0.7 trust gate (0 to 1)" },
      },
      required: ["name"],
    },
  },
];

function rpc(id: unknown, result: unknown, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }), {
    headers: { "content-type": "application/json", ...(extraHeaders ?? {}) },
  });
}
function rpcError(id: unknown, code: number, message: string) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }),
    {
      headers: { "content-type": "application/json" },
    },
  );
}
function toolResult(
  id: unknown,
  text: string,
  isError = false,
  extraHeaders?: Record<string, string>,
) {
  return rpc(id, { content: [{ type: "text", text }], isError }, extraHeaders);
}
function json402(bodyObj: unknown) {
  return new Response(JSON.stringify(bodyObj), {
    status: 402,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { id?: unknown; method?: string; params?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return rpcError(null, -32700, "Parse error");
        }
        const { id, method, params } = body ?? {};

        switch (method) {
          case "initialize":
            return rpc(id, {
              protocolVersion: (params?.protocolVersion as string) ?? PROTOCOL,
              capabilities: { tools: {} },
              serverInfo: { name: "legibility-mcp", version: "0.3" },
            });
          case "notifications/initialized":
          case "initialized":
            return new Response(null, { status: 202 });
          case "ping":
            return rpc(id, {});
          case "tools/list":
            return rpc(id, { tools: TOOLS });
          case "tools/call": {
            const name = params?.name as string | undefined;
            const args = (params?.arguments ?? {}) as Record<string, unknown>;
            if (name !== "read_product" && name !== "resolve_product") {
              return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
            }
            // Validate the request shape (free) before charging.
            const payload: Record<string, unknown> = {};
            if (name === "read_product") {
              const hasUrl = typeof args.url === "string" && (args.url as string).length > 0;
              const hasGtin = typeof args.gtin === "string" && (args.gtin as string).length > 0;
              if (hasUrl === hasGtin) {
                return toolResult(
                  id,
                  JSON.stringify({
                    error: "invalid_request",
                    message: "Provide exactly one of: url, gtin.",
                  }),
                  true,
                );
              }
              if (hasUrl) payload.url = args.url;
              if (hasGtin) payload.gtin = args.gtin;
            } else {
              if (typeof args.name !== "string" || (args.name as string).trim().length < 2) {
                return toolResult(
                  id,
                  JSON.stringify({
                    error: "invalid_request",
                    message: "Provide a product name (2+ chars).",
                  }),
                  true,
                );
              }
              payload.name = (args.name as string).trim();
            }
            if (typeof args.min_confidence === "number")
              payload.min_confidence = args.min_confidence;

            // Auth: a lgk_ key OR a settled x402 payment.
            const authz = request.headers.get("authorization");
            const presented = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
            const { validateApiKey } = await import("@/integrations/supabase/api-keys.server");
            const principal = await validateApiKey(presented);

            let xPaymentResponse: string | undefined;
            if (!principal) {
              const { paymentRequirements, quote402, settle } =
                await import("@/lib/api/x402.server");
              const resource = new URL(request.url).toString();
              const desc = `Legibility ${name}`;
              const xpay = request.headers.get("x-payment");
              if (!xpay) return json402(quote402(resource, desc));
              const s = await settle(xpay, paymentRequirements(resource, desc));
              if (!s.ok) return json402(quote402(resource, desc, { settle_error: s.reason }));
              xPaymentResponse = s.settleHeader;
            }

            // Per-plan rate limit (keyed calls only; x402 calls are paid per call on-chain).
            if (principal) {
              const { rateCheck } = await import("@/integrations/supabase/rate-limit.server");
              const rl = await rateCheck(principal.userId);
              if (!rl.allowed) {
                return new Response(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: id ?? null,
                    error: { code: -32099, message: "Rate limit exceeded." },
                  }),
                  {
                    status: 429,
                    headers: {
                      "content-type": "application/json",
                      "retry-after": String(rl.reset),
                      "x-ratelimit-limit": String(rl.limit),
                      "x-ratelimit-remaining": String(Math.max(0, rl.limit - rl.used)),
                      "x-ratelimit-reset": String(rl.reset),
                    },
                  },
                );
              }
              // Monthly quota + cost fuse for keyed calls (x402 calls are paid per call).
              const { entitlementCheck } =
                await import("@/integrations/supabase/entitlement.server");
              const ent = await entitlementCheck(principal.userId);
              if (!ent.allowed) {
                return new Response(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: id ?? null,
                    error: {
                      code: -32098,
                      message:
                        ent.reason === "cost_fuse"
                          ? "Free usage safety limit reached."
                          : `Monthly quota reached (${ent.included_calls} calls). Upgrade to continue.`,
                    },
                  }),
                  { status: 402, headers: { "content-type": "application/json" } },
                );
              }
            }

            const WORKER_URL = process.env.PLINTH_EXTRACTOR_URL;
            const WORKER_TOKEN = process.env.PLINTH_EXTRACTOR_TOKEN;
            if (!WORKER_URL || !WORKER_TOKEN) {
              return toolResult(
                id,
                JSON.stringify({ error: "external_worker_not_configured" }),
                true,
              );
            }
            const started = Date.now();
            let text = JSON.stringify({ error: "upstream_unavailable" });
            let status = 502;
            try {
              const res = await fetch(WORKER_URL, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${WORKER_TOKEN}`,
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(30000),
              });
              text = await res.text();
              status = res.status;
            } catch {
              /* upstream failure */
            }

            // Meter keyed calls (x402 calls are recorded on-chain by the facilitator).
            if (principal) {
              const { stampFromResponse } = await import("@/lib/api/meter");
              const stamp = stampFromResponse(
                text,
                payload as { url?: unknown; gtin?: unknown; name?: unknown },
              );
              try {
                const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                await Promise.all([
                  supabaseAdmin.from("usage_events").insert({
                    user_id: principal.userId,
                    api_key_id: principal.keyId,
                    tool: name,
                    endpoint: "/api/mcp",
                    cached: stamp.cached,
                    status,
                    cost_usd: stamp.cost_usd,
                    latency_ms: Date.now() - started,
                    request_id: stamp.request_id,
                    confidence: stamp.confidence,
                    product_returned: stamp.product_returned,
                    billable: stamp.billable,
                    domain: stamp.domain,
                    envelope_hash: stamp.envelope_hash,
                    calibration_version: stamp.calibration_version,
                  }),
                  supabaseAdmin
                    .from("api_keys")
                    .update({ last_used_at: new Date().toISOString() })
                    .eq("id", principal.keyId),
                ]);
              } catch {
                /* metering best-effort */
              }
            }

            return toolResult(
              id,
              text,
              false,
              xPaymentResponse ? { "x-payment-response": xPaymentResponse } : undefined,
            );
          }
          default:
            return rpcError(id, -32601, `Method not found: ${String(method)}`);
        }
      },
      GET: async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Method not allowed." },
            id: null,
          }),
          { status: 405, headers: { "content-type": "application/json", allow: "POST" } },
        ),
    },
  },
});
