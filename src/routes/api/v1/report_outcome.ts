import { createFileRoute } from "@tanstack/react-router";
import { postOnly } from "@/lib/api/http";

// PLAN P4.5 + MOAT: the outcome-closure channel. An agent reports whether a Legibility
// answer led to a real outcome (the buy succeeded at the stated price, or it did not).
// This is the ONE label class a competitor cannot crawl, buy, or self-adjudicate,
// because it exists only downstream of a real agent acting on a real Legibility answer.
// Keyed by plk_ (the agent's identity), joined to usage via request_id / legibility_id.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const OUTCOMES = new Set(["purchased", "price_matched", "price_mismatch", "out_of_stock", "wrong_product", "other"]);

export const Route = createFileRoute("/api/v1/report_outcome")({
  server: {
    handlers: {
      ...postOnly,
      POST: async ({ request }) => {
        const authz = request.headers.get("authorization");
        const presented = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
        const { validateApiKey } = await import("@/integrations/supabase/api-keys.server");
        const principal = await validateApiKey(presented);
        if (!principal) return json({ error: "unauthorized", message: "Provide a valid plk_ API key as a Bearer token." }, 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const outcome = typeof b.outcome === "string" ? b.outcome : "";
        if (!OUTCOMES.has(outcome)) {
          return json({ error: "invalid_request", message: `outcome must be one of: ${[...OUTCOMES].join(", ")}` }, 422);
        }
        if (typeof b.request_id !== "string" && typeof b.legibility_id !== "string") {
          return json({ error: "invalid_request", message: "Provide request_id or legibility_id to link the outcome to a read." }, 422);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("outcome_reports").insert({
          user_id: principal.userId,
          request_id: typeof b.request_id === "string" ? b.request_id : null,
          legibility_id: typeof b.legibility_id === "string" ? b.legibility_id : null,
          outcome,
          observed_price: typeof b.observed_price === "number" ? b.observed_price : null,
          observed_currency: typeof b.observed_currency === "string" ? b.observed_currency : null,
          note: typeof b.note === "string" ? b.note.slice(0, 500) : null,
        });
        if (error) return json({ error: "insert_failed", message: error.message }, 500);
        return json({ received: true }, 202);
      },
    },
  },
});
