import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A2: the first verified session of an account.
 *
 * Writes the server-side email_verified event once per account and says whether this call
 * was the first, so the browser sends GA4 and PostHog sign_up exactly once, with the
 * account's channel label and invitation id and nothing else. A signed-in session means the
 * magic link was opened, which is what verifies the address.
 */
export const claimSignUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("record_email_verified", {
      _account_id: userId,
    });
    const row = data?.[0];
    if (error || !row) {
      if (error) console.error("[attribution] sign-up not recorded", error.code);
      return { first: false, channel: null, invitation_id: null };
    }
    return { first: row.first, channel: row.source, invitation_id: row.invitation_id };
  });
