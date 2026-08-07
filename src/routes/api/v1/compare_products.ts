import { createFileRoute } from "@tanstack/react-router";
import { postOnly } from "@/lib/api/http";

// v1 REST: compare_products. Extracts 2 to 5 product URLs (via the worker) and returns a
// side-by-side matrix plus the price delta. Validates a lgk_ key, rate-limits, meters once.

type Envelope = {
  input?: { url?: string };
  product?: {
    title?: string;
    brand?: string | null;
    price?: { low: number; high: number; currency: string } | null;
    availability?: string;
  } | null;
  confidence?: number;
  method?: string;
  cost_usd?: number;
  cached?: boolean;
};

function json(body: unknown, status: number, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(extra ?? {}), "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/v1/compare_products")({
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
        const urls = (body as { urls?: unknown }).urls;
        if (
          !Array.isArray(urls) ||
          urls.length < 2 ||
          urls.length > 5 ||
          !urls.every((u) => typeof u === "string" && u.length > 0)
        ) {
          return json(
            {
              error: "invalid_request",
              message: "Provide 'urls': an array of 2 to 5 product URLs.",
            },
            422,
            rlh,
          );
        }

        const started = Date.now();
        const results = await Promise.all(
          (urls as string[]).map(async (url): Promise<Envelope> => {
            try {
              const res = await fetch(WORKER_URL, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${WORKER_TOKEN}`,
                },
                body: JSON.stringify({ url }),
                signal: AbortSignal.timeout(25000),
              });
              return (await res.json()) as Envelope;
            } catch {
              return { input: { url }, product: null, confidence: 0, cost_usd: 0, cached: false };
            }
          }),
        );

        const items = results.map((e) => ({
          url: e.input?.url ?? null,
          title: e.product?.title ?? null,
          brand: e.product?.brand ?? null,
          price: e.product?.price ?? null,
          availability: e.product?.availability ?? null,
          confidence: e.confidence ?? 0,
          method: e.method ?? null,
        }));
        const lows = items
          .map((i) => i.price?.low)
          .filter((n): n is number => typeof n === "number");
        const price_delta = lows.length
          ? {
              min: Math.min(...lows),
              max: Math.max(...lows),
              spread: Number((Math.max(...lows) - Math.min(...lows)).toFixed(2)),
              currency: items.find((i) => i.price)?.price?.currency ?? null,
            }
          : null;
        const cost = Number(
          results
            .reduce((s, e) => s + (typeof e.cost_usd === "number" ? e.cost_usd : 0), 0)
            .toFixed(6),
        );
        const cached = results.some((e) => e.cached);

        // Stamp with the best (highest-confidence) envelope of the batch; domain from the first URL.
        const best = results.reduce(
          (a, e) => ((e.confidence ?? 0) > (a.confidence ?? 0) ? e : a),
          results[0],
        );
        const { stampFromResponse } = await import("@/lib/api/meter");
        const stamp = stampFromResponse(JSON.stringify(best ?? {}), { url: (urls as string[])[0] });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await Promise.all([
            supabaseAdmin.from("usage_events").insert({
              user_id: principal.userId,
              api_key_id: principal.keyId,
              tool: "compare_products",
              endpoint: "/api/v1/compare_products",
              cached,
              status: 200,
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

        return json({ input: { urls }, items, price_delta, cost_usd: cost, cached }, 200, rlh);
      },
    },
  },
});
