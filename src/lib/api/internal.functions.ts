import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  INTERNAL_CLASSES,
  internalListErrorMessage,
  parseAccountIdentifier,
} from "@/lib/api/internal-accounts";

/**
 * A1: the admin action that keeps the internal list.
 *
 * The North Star counts external keys only, so which accounts are internal is a decision
 * Krish makes, at run time, here. Nothing seeds this list: no migration or fixture names an
 * account. Admin-gated the same way getMetrics and getWaitlist are, since the tables are
 * service-role only. Every change is written to audit_log with the admin's account id.
 */

export type InternalKey = {
  key_id: string;
  prefix: string;
  last_four: string;
  revoked: boolean;
  class: string | null;
};

export type InternalAccount = {
  account_id: string;
  class: string;
  added_at: string;
  label: string | null;
  keys: InternalKey[];
};

async function isAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

async function audit(actor: string, action: string, target: string, meta: Record<string, string>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("audit_log").insert({ actor, action, target, meta });
  if (error) console.error("[internal] audit write failed", error.code);
}

const classSchema = z.enum(INTERNAL_CLASSES);

export const getInternalList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) return { admin: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accounts, error } = await supabaseAdmin
      .from("internal_accounts")
      .select("account_id, class, added_at")
      .order("added_at", { ascending: true });
    if (error) {
      console.error("[internal] list failed", error.code);
      return { admin: true as const, accounts: [] as InternalAccount[], error: true };
    }
    const ids = (accounts ?? []).map((a) => a.account_id);
    if (ids.length === 0) return { admin: true as const, accounts: [] as InternalAccount[] };

    const [profiles, keys, labels] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email").in("id", ids),
      supabaseAdmin
        .from("api_keys")
        .select("id, user_id, prefix, last_four, revoked_at")
        .in("user_id", ids),
      supabaseAdmin.from("internal_keys").select("key_id, class"),
    ]);
    const labelOf = new Map((labels.data ?? []).map((l) => [l.key_id, l.class]));
    const emailOf = new Map((profiles.data ?? []).map((p) => [p.id, p.email]));

    const rows: InternalAccount[] = (accounts ?? []).map((a) => ({
      account_id: a.account_id,
      class: a.class,
      added_at: a.added_at,
      // Shown to the admin only, at run time, so a row can be recognised. Never stored here.
      label: emailOf.get(a.account_id) ?? null,
      keys: (keys.data ?? [])
        .filter((k) => k.user_id === a.account_id)
        .map((k) => ({
          key_id: k.id,
          prefix: k.prefix,
          last_four: k.last_four,
          revoked: k.revoked_at !== null,
          class: labelOf.get(k.id) ?? null,
        })),
    }));
    return { admin: true as const, accounts: rows };
  });

export const addInternalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ identifier: z.string().trim().min(1).max(320), class: classSchema }))
  .handler(async ({ data, context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) throw new Error("Not permitted.");

    const parsed = parseAccountIdentifier(data.identifier);
    if (!parsed) throw new Error("Enter an account id or the account's sign-in address.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lookup =
      parsed.kind === "id"
        ? supabaseAdmin.from("profiles").select("id").eq("id", parsed.id)
        : supabaseAdmin.from("profiles").select("id").ilike("email", parsed.email);
    const { data: found } = await lookup.limit(2);
    if (!found || found.length !== 1) throw new Error("No single account matches that.");
    const accountId = found[0].id;

    const { error } = await supabaseAdmin
      .from("internal_accounts")
      .upsert(
        { account_id: accountId, class: data.class, added_by: userId },
        { onConflict: "account_id" },
      );
    if (error) throw new Error(internalListErrorMessage(error));
    await audit(userId, "internal_account.added", accountId, { class: data.class });
    return { ok: true };
  });

export const removeInternalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ accountId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) throw new Error("Not permitted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("internal_accounts")
      .delete()
      .eq("account_id", data.accountId);
    if (error) throw new Error(internalListErrorMessage(error));
    await audit(userId, "internal_account.removed", data.accountId, {});
    return { ok: true };
  });

export const setInternalKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ keyId: z.string().uuid(), class: classSchema.nullable() }))
  .handler(async ({ data, context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) throw new Error("Not permitted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The database refuses a key whose account is not internal; that refusal is the rule,
    // and the message below only puts it into words.
    const { error } =
      data.class === null
        ? await supabaseAdmin.from("internal_keys").delete().eq("key_id", data.keyId)
        : await supabaseAdmin
            .from("internal_keys")
            .upsert({ key_id: data.keyId, class: data.class }, { onConflict: "key_id" });
    if (error) throw new Error(internalListErrorMessage(error));
    await audit(
      userId,
      data.class === null ? "internal_key.removed" : "internal_key.added",
      data.keyId,
      data.class === null ? {} : { class: data.class },
    );
    return { ok: true };
  });
