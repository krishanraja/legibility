import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The operator's read path onto the waitlist.
 *
 * waitlist.status, approved_at and approved_by have existed since the first migration and
 * were written by nothing and read by nothing. The only way to see who had signed up was the
 * Supabase table editor, which means in practice nobody looked, which means the capture form
 * was collecting addresses into a drawer.
 *
 * Admin-gated the same way getMetrics is: the tables are service-role only, so the function
 * checks the role itself and a non-admin gets a non-privileged payload rather than an error.
 */

export type WaitlistRow = {
  id: string;
  email: string;
  company: string | null;
  status: string;
  created_at: string;
  source: string | null;
  check: {
    host: string;
    readable: boolean;
    failure_reason: string | null;
    checked_at: string;
  } | null;
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

export const getWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) return { admin: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The check that converted them travels with the row. A waitlist without the finding
    // attached is a list of addresses; with it, it is a list of people who have just been
    // told something specific about their own site, which is the only reason to look.
    const { data, error } = await supabaseAdmin
      .from("waitlist")
      .select(
        "id, email, company, status, created_at, source, domain_checks:check_id (host, readable, failure_reason, checked_at)",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[waitlist] read failed", error);
      return { admin: true as const, rows: [] as WaitlistRow[] };
    }

    const rows = (data ?? []).map((r) => {
      const { domain_checks, ...rest } = r as Record<string, unknown> & {
        domain_checks: WaitlistRow["check"] | WaitlistRow["check"][] | null;
      };
      return {
        ...(rest as Omit<WaitlistRow, "check">),
        // PostgREST returns an embedded one-to-one as an object, but as an array when it
        // cannot prove the cardinality. Normalised here so the component does not have to
        // know which shape it got.
        check: Array.isArray(domain_checks) ? (domain_checks[0] ?? null) : domain_checks,
      } as WaitlistRow;
    });

    return { admin: true as const, rows };
  });

/**
 * Record a decision on a waitlist row.
 *
 * approved_by is taken from the verified token, never from the client, so the audit trail
 * names whoever actually clicked rather than whoever the request claimed to be.
 */
export const setWaitlistStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected"]) }),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as { userId: string }).userId;
    if (!(await isAdmin(userId))) throw new Error("Not permitted.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("waitlist")
      .update({
        status: data.status,
        // Cleared when a decision is undone, so the timestamp never outlives the decision it
        // was recording.
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
        approved_by: data.status === "approved" ? userId : null,
      })
      .eq("id", data.id);

    if (error) {
      console.error("[waitlist] status update failed", error);
      throw new Error("That did not save.");
    }
    return { ok: true };
  });
