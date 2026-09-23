import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STRIPE_API = "https://api.stripe.com/v1";

async function stripePost(path: string, params: Record<string, string>, sk: string) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${STRIPE_API}/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${sk}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
}

import { APP_ORIGIN } from "@/config/product";

function baseUrl() {
  return process.env.APP_BASE_URL ?? APP_ORIGIN;
}

/**
 * Turn a Stripe error into something safe to put in front of a visitor.
 *
 * Stripe's messages are written for the merchant, not the buyer. The one this account
 * returns today is "No valid payment method types for this Checkout Session. Please ensure
 * that you have activated payment methods compatible with your chosen currency in your
 * dashboard (https://dashboard.stripe.com/settings/payment_methods)", which tells a customer
 * to go and configure someone else's Stripe account and reads as a broken product.
 *
 * The real message is logged, because whoever is on call needs the exact string, and the
 * caller gets a sentence that is true without being an instruction meant for somebody else.
 */
function customerFacingStripeError(context: string, raw: string | undefined): Error {
  console.error(`[billing] ${context}: ${raw ?? "no message"}`);
  return new Error("Payments are not available right now. Nothing was charged.");
}

// Start a Stripe Checkout (subscription) for the signed-in user. Returns the hosted URL.
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ plan: z.enum(["starter", "growth"]) }))
  .handler(async ({ data, context }) => {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) throw new Error("Billing is not configured.");
    const userId = (context as { userId: string }).userId;
    const email = (context as { claims?: { email?: string } }).claims?.email;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("stripe_price_id")
      .eq("id", data.plan)
      .single();
    const priceId = plan?.stripe_price_id;
    if (!priceId) throw new Error("That plan is not purchasable yet.");

    const params: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${baseUrl()}/dashboard/billing?status=success`,
      cancel_url: `${baseUrl()}/dashboard/billing?status=cancel`,
      client_reference_id: userId,
      "metadata[user_id]": userId,
      "subscription_data[metadata][user_id]": userId,
      allow_promotion_codes: "true",
    };
    if (email) params.customer_email = email;

    const session = await stripePost("checkout/sessions", params, sk);
    if (!session.url) throw customerFacingStripeError("checkout session", session.error?.message);
    return { url: session.url as string };
  });

// Open the Stripe billing portal for the signed-in user's existing customer.
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) throw new Error("Billing is not configured.");
    const userId = (context as { userId: string }).userId;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    const customer = sub?.stripe_customer_id;
    if (!customer) throw new Error("No billing account yet. Subscribe first.");

    const session = await stripePost(
      "billing_portal/sessions",
      { customer, return_url: `${baseUrl()}/dashboard/billing` },
      sk,
    );
    if (!session.url) throw customerFacingStripeError("portal session", session.error?.message);
    return { url: session.url as string };
  });
