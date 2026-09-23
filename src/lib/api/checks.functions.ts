import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The signed-in person's own readability checks.
 *
 * The dashboard's first screen used to be a curl sample for the product-data API, which is
 * the wrong first screen for the buyer the front page is written for: someone who checked
 * their domain, got a verdict, and made an account because of it. This is what they came back
 * for.
 *
 * Checks are matched by email rather than by user id, because a capture happens before and
 * usually without an account. Someone who checked three domains anonymously and then signed
 * in with the same address finds all three waiting, which is the behaviour that makes the
 * account worth creating at all.
 *
 * The email comes from the verified token claims, never from anything the client sends. It is
 * the whole authorisation check here, so it does not get to be an argument.
 */

export type CheckRow = {
  id: string;
  host: string;
  checked_at: string;
  readable: boolean;
  failure_reason: string | null;
  method: string;
  detail: string | null;
};

export const getMyChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = (context as { claims: { email?: string } }).claims;
    const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
    if (!email) return { checks: [] as CheckRow[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Two steps rather than one embedded select. The join goes through check_captures, which
    // is service-role only, and keeping the queries separate makes the email filter the
    // obvious single point where one person's rows are separated from another's.
    const { data: captures, error: captureError } = await supabaseAdmin
      .from("check_captures")
      .select("check_id")
      .eq("email", email)
      .order("captured_at", { ascending: false })
      .limit(200);

    if (captureError) {
      console.error("[checks] capture lookup failed", captureError);
      return { checks: [] as CheckRow[] };
    }

    const ids = (captures ?? []).map((c) => c.check_id);
    if (ids.length === 0) return { checks: [] as CheckRow[] };

    const { data: checks, error: checksError } = await supabaseAdmin
      .from("domain_checks")
      .select("id, host, checked_at, readable, failure_reason, method, detail")
      .in("id", ids)
      .order("checked_at", { ascending: false });

    if (checksError) {
      console.error("[checks] check lookup failed", checksError);
      return { checks: [] as CheckRow[] };
    }

    return { checks: (checks ?? []) as CheckRow[] };
  });
