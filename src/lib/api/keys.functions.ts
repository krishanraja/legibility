import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Create an API key for the signed-in user. Returns the full lgk_ key ONCE.
// v1: one active key per account (per docs); revoke the existing one to create another.
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(40).default("default") }))
  .handler(async ({ data, context }) => {
    const { issueKey } = await import("@/integrations/supabase/api-keys.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const userId = (context as { userId: string }).userId;
    // A2: the session's touch (the lg_touch cookie) is attached to the key inside issueKey.
    const issued = await issueKey(userId, data.name, getRequest()?.headers.get("cookie"));
    if (!issued) {
      throw new Error("You already have an active key (1 per account in v1). Revoke it first.");
    }
    return { key: issued.key, prefix: issued.prefix, last_four: issued.last_four };
  });

// Revoke one of the signed-in user's keys.
export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as { userId: string }).userId;
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error("Could not revoke key.");
    return { ok: true };
  });
