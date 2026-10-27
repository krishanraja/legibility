import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Create an API key for the signed-in user. Returns the full lgk_ key ONCE.
// v1: one active key per account (per docs); revoke the existing one to create another.
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(40).default("default") }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateKeyMaterial } = await import("@/integrations/supabase/api-keys.server");
    const userId = (context as { userId: string }).userId;

    const { data: existing } = await supabaseAdmin
      .from("api_keys")
      .select("id")
      .eq("user_id", userId)
      .is("revoked_at", null);
    if (existing && existing.length >= 1) {
      throw new Error("You already have an active key (1 per account in v1). Revoke it first.");
    }

    const mat = generateKeyMaterial();
    const { data: created, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        user_id: userId,
        name: data.name,
        prefix: mat.prefix,
        key_hash: mat.key_hash,
        last_four: mat.last_four,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error("Could not create key.");

    // A2: attach this session's touch (the lg_touch cookie, validated again) to the key, or
    // the account's enrolment touch when the session has none. Best-effort: a key is never
    // refused because attribution could not be written.
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const { touchFromCookie } = await import("@/lib/api/attribution");
      const touch = touchFromCookie(getRequest()?.headers.get("cookie"), new Date());
      const { error: touchError } = await supabaseAdmin.rpc("record_key_creation", {
        _key_id: created.id,
        _touch: touch,
      });
      if (touchError) console.error("[keys] key touch not recorded", touchError.code);
    } catch {
      /* attribution best-effort */
    }
    return { key: mat.key, prefix: mat.prefix, last_four: mat.last_four };
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
