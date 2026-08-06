import { createFileRoute } from "@tanstack/react-router";
import { postOnly } from "@/lib/api/http";

// v1 REST: resolve_product. Fuzzy product name -> typed product object (via Exa retrieval + extraction
// on the worker). Validates a lgk_ key, rate-limits, meters. Returns the worker's ProductEnvelope.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/v1/resolve_product")({
  server: {
    handlers: {
      ...postOnly,
      POST: async ({ request }) => {
        const WORKER_URL = process.env.PLINTH_EXTRACTOR_URL;
        const WORKER_TOKEN = process.env.PLINTH_EXTRACTOR_TOKEN;
        if (!WORKER_URL || !WORKER_TOKEN) {
          return json({ error: "external_worker_not_configured", message: "resolve_product is temporarily unavailable." }, 503);
        }

        const authz = request.headers.get("authorization");
        const presented = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
        const { validateApiKey } = await import("@/integrations/supabase/api-keys.server");
        const principal = await validateApiKey(presented);
        if (!principal) {
          return json({ error: "unauthorized", message: "Provide a valid lgk_ API key as a Bearer token." }, 401);
        }

        const { rateCheck, rateHeaders } = await import("@/integrations/supabase/rate-limit.server");
        const rl = await rateCheck(principal.userId);
        const rlh = rateHeaders(rl);
        if (!rl.allowed) {
          return new Response(
            JSON.stringify({ error: "rate_limited", message: "Rate limit exceeded. Slow down or upgrade your plan." }),
            { status: 429, headers: { ...rlh, "retry-after": String(rl.reset), "content-type": "application/json" } },
          );
        }

        const { entitlementCheck, quotaBlockedBody } = await import("@/integrations/supabase/entitlement.server");
        const ent = await entitlementCheck(principal.userId);
        if (!ent.allowed) {
          const { APP_ORIGIN } = await import("@/config/product");
          return json(quotaBlockedBody(ent, `${APP_ORIGIN}/dashboard/billing`), 402);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }
        const b = (body ?? {}) as Record<string, unknown>;
        if (typeof b.name !== "string" || b.name.trim().length < 2) {
          return json({ error: "invalid_request", message: "Provide a product name (string, 2+ chars)." }, 422);
        }
        const payload: Record<string, unknown> = { name: b.name.trim() };
        if (typeof b.min_confidence === "number") payload.min_confidence = b.min_confidence;

        const started = Date.now();
        let status = 502;
        let text = JSON.stringify({ error: "upstream_unavailable", message: "The extraction worker did not respond." });
        try {
          const res = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${WORKER_TOKEN}` },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000),
          });
          text = await res.text();
          status = res.status;
        } catch {
          /* upstream */
        }

        const { stampFromResponse } = await import("@/lib/api/meter");
        const stamp = stampFromResponse(text, { name: b.name });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await Promise.all([
            supabaseAdmin.from("usage_events").insert({
              user_id: principal.userId,
              api_key_id: principal.keyId,
              tool: "resolve_product",
              endpoint: "/api/v1/resolve_product",
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
            supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", principal.keyId),
          ]);
        } catch {
          /* metering best-effort */
        }

        return new Response(text, { status, headers: { ...rlh, "content-type": "application/json" } });
      },
    },
  },
});
