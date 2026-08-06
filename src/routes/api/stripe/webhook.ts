import { createFileRoute } from "@tanstack/react-router";
import { postOnly } from "@/lib/api/http";
import { mapStatus, verifySignature } from "@/lib/api/stripe-signature";

/* eslint-disable @typescript-eslint/no-explicit-any -- Stripe webhook event payloads are dynamic untyped JSON */

// Stripe webhook. Verifies the signature manually (no SDK), then mirrors subscriptions + invoices.
// Signature verification and status mapping live in @/lib/api/stripe-signature so they are
// unit-testable without importing this route.

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function upsertSubscription(admin: AdminClient, userId: string, sub: Record<string, any>) {
  const priceId = sub.items?.data?.[0]?.price?.id as string | undefined;
  let planId = "free";
  if (priceId) {
    const { data: plan, error } = await admin
      .from("plans")
      .select("id")
      .eq("stripe_price_id", priceId)
      .maybeSingle();
    // Never silently fall back to "free" on a lookup failure: that downgrades a paying
    // customer. Throw so the handler returns 5xx and Stripe redelivers.
    if (error) throw new Error(`plans lookup failed for price ${priceId}: ${error.message}`);
    if (plan?.id) planId = plan.id;
  }
  const { error: upsertError } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      status: mapStatus(String(sub.status)),
      stripe_customer_id: sub.customer ?? null,
      stripe_subscription_id: sub.id ?? null,
      current_period_start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    },
    { onConflict: "user_id" },
  );
  // supabase-js resolves with { error } rather than throwing, so an unchecked call
  // fails silently. Surface it.
  if (upsertError)
    throw new Error(`subscriptions upsert failed for ${userId}: ${upsertError.message}`);
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      ...postOnly,
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const sk = process.env.STRIPE_SECRET_KEY;
        if (!secret || !sk) return new Response("billing not configured", { status: 503 });

        const raw = await request.text();
        if (!verifySignature(raw, request.headers.get("stripe-signature"), secret)) {
          return new Response("bad signature", { status: 400 });
        }

        let event: { type?: string; data?: { object?: Record<string, any> } };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("bad payload", { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const obj = event.data?.object ?? {};
          switch (event.type) {
            case "checkout.session.completed": {
              const userId = (obj.client_reference_id as string) ?? obj.metadata?.user_id;
              if (userId && obj.subscription) {
                const sub = (await (
                  await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, {
                    headers: { authorization: `Bearer ${sk}` },
                  })
                ).json()) as Record<string, any>;
                await upsertSubscription(supabaseAdmin, userId, sub);
              }
              break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              const userId = obj.metadata?.user_id as string | undefined;
              if (userId) await upsertSubscription(supabaseAdmin, userId, obj);
              break;
            }
            case "invoice.paid":
            case "invoice.payment_failed": {
              const { data: sub, error: lookupError } = await supabaseAdmin
                .from("subscriptions")
                .select("user_id")
                .eq("stripe_customer_id", obj.customer)
                .maybeSingle();
              if (lookupError) {
                throw new Error(
                  `subscription lookup failed for customer ${obj.customer}: ${lookupError.message}`,
                );
              }
              if (sub?.user_id) {
                const { error: invoiceError } = await supabaseAdmin.from("invoices").upsert(
                  {
                    user_id: sub.user_id,
                    stripe_invoice_id: obj.id,
                    amount_cents: (obj.amount_paid ?? obj.amount_due ?? 0) as number,
                    currency: (obj.currency as string) ?? "usd",
                    status: (obj.status as string) ?? "open",
                    hosted_url: (obj.hosted_invoice_url as string) ?? null,
                    pdf_url: (obj.invoice_pdf as string) ?? null,
                    period_start: obj.period_start
                      ? new Date(obj.period_start * 1000).toISOString()
                      : null,
                    period_end: obj.period_end
                      ? new Date(obj.period_end * 1000).toISOString()
                      : null,
                  },
                  { onConflict: "stripe_invoice_id" },
                );
                if (invoiceError) {
                  throw new Error(`invoice upsert failed for ${obj.id}: ${invoiceError.message}`);
                }
              }
              break;
            }
          }
        } catch (e) {
          // Returning 200 here would tell Stripe the event was handled and stop redelivery,
          // permanently losing a subscription or invoice on a transient DB failure. Return
          // 500 so Stripe retries on its own backoff schedule.
          console.error("[stripe webhook]", e);
          return new Response(JSON.stringify({ error: "handler_failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
