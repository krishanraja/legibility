import { createFileRoute } from "@tanstack/react-router";
import { postOnly } from "@/lib/api/http";
import { composeBrief, type BriefEnvelope as Envelope } from "@/lib/api/brief";

// v1 REST: brief_product. One input (url | gtin | name) -> typed product + a short
// agent-readable brief composed from the typed fields (no LLM; deterministic + honest).

function json(body: unknown, status: number, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(extra ?? {}), "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/brief_product")({
  server: {
    handlers: {
      ...postOnly,
      POST: async ({ request }) => {
        const WORKER_URL = process.env.PLINTH_EXTRACTOR_URL;
        const WORKER_TOKEN = process.env.PLINTH_EXTRACTOR_TOKEN;
        if (!WORKER_URL || !WORKER_TOKEN)
          return json({ error: "external_worker_not_configured" }, 503);

        const authz = request.headers.get("authorization");
        const presented = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
        const { validateApiKey } = await import("@/integrations/supabase/api-keys.server");
        const principal = await validateApiKey(presented);
        if (!principal)
          return json(
            { error: "unauthorized", message: "Provide a valid lgk_ API key as a Bearer token." },
            401,
          );

        const { rateCheck, rateHeaders } =
          await import("@/integrations/supabase/rate-limit.server");
        const rl = await rateCheck(principal.userId);
        const rlh = rateHeaders(rl);
        if (!rl.allowed)
          return json({ error: "rate_limited", message: "Rate limit exceeded." }, 429, {
            ...rlh,
            "retry-after": String(rl.reset),
          });

        const { entitlementCheck, quotaBlockedBody } =
          await import("@/integrations/supabase/entitlement.server");
        const ent = await entitlementCheck(principal.userId);
        if (!ent.allowed) {
          const { APP_ORIGIN } = await import("@/config/product");
          return json(quotaBlockedBody(ent, `${APP_ORIGIN}/dashboard/billing`), 402, rlh);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const provided = (["url", "gtin", "name"] as const).filter(
          (k) => typeof b[k] === "string" && (b[k] as string).length > 0,
        );
        if (provided.length !== 1) {
          return json(
            { error: "invalid_request", message: "Provide exactly one of: url, gtin, name." },
            422,
            rlh,
          );
        }
        const payload: Record<string, unknown> = { [provided[0]]: b[provided[0]] };
        if (typeof b.min_confidence === "number") payload.min_confidence = b.min_confidence;

        const started = Date.now();
        let env: Envelope = { product: null, confidence: 0, cost_usd: 0, cached: false };
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
          status = res.status;
          env = (await res.json()) as Envelope;
        } catch {
          /* upstream */
        }

        const cost = typeof env.cost_usd === "number" ? env.cost_usd : 0;
        const { stampFromResponse } = await import("@/lib/api/meter");
        const stamp = stampFromResponse(JSON.stringify(env), { [provided[0]]: b[provided[0]] });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await Promise.all([
            supabaseAdmin.from("usage_events").insert({
              user_id: principal.userId,
              api_key_id: principal.keyId,
              tool: "brief_product",
              endpoint: "/api/v1/brief_product",
              cached: Boolean(env.cached),
              status,
              cost_usd: cost,
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

        return json(
          {
            input: { [provided[0]]: b[provided[0]] },
            product: env.product ?? null,
            confidence: env.confidence ?? 0,
            method: env.method ?? null,
            brief: composeBrief(env),
            cost_usd: cost,
            cached: Boolean(env.cached),
          },
          200,
          rlh,
        );
      },
    },
  },
});
