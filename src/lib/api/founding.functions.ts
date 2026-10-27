import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A3: the Founding 200 page's server side. The rules and words are in ./founding.ts; this
 * file only wires them to the request, the database and the worker.
 *
 * Server-side events for the export (A4): beta_page_viewed (once per hashed IP a day),
 * testbench_started, testbench_completed, founding_200_submitted (once per entry); email_verified
 * and key_created come from A2's functions.
 */

async function requestContext() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { clientIp } = await import("@/lib/api/rate-limit");
  const { touchFromCookie, channelLabel } = await import("@/lib/api/attribution");
  const request = getRequest();
  const cookie = request?.headers.get("cookie") ?? null;
  const touch = touchFromCookie(cookie, new Date());
  return {
    ip: request ? clientIp(request) : "unknown",
    cookie,
    source: channelLabel(touch),
  };
}

async function event(type: string, source: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("growth_events")
    .insert({ type, account_id: null, source });
  if (error) console.error("[founding] event not recorded", type, error.code);
}

/** What the page needs to render: the challenge's public site key. */
export const getFoundingSetup = createServerFn({ method: "GET" }).handler(async () => ({
  siteKey: process.env.TURNSTILE_SITE_KEY ?? null,
}));

/** beta_page_viewed, once per hashed IP per UTC day. Never fails the page. */
export const recordFoundingView = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const key = process.env.EXPORT_ID_KEY;
    if (!key) return { ok: false };
    const { ipHash } = await import("@/lib/api/founding");
    const ctx = await requestContext();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("record_founding_view", {
      _ip_hash: ipHash(ctx.ip, key),
      _source: ctx.source,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

export type FoundingRunResult =
  | { ok: false; message: string }
  | {
      ok: true;
      entryId: string;
      trusted: boolean;
      report: import("@/lib/api/founding").FoundingReport;
    };

/** One test run, before any email: limits, challenge, the worker, the entry. */
export const runFoundingTest = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      input: z.string().max(2048),
      use_case: z.string().max(2000).optional(),
      interface: z.enum(["rest", "mcp"]).optional(),
      stores: z.string().max(500).optional(),
      token: z.string().max(2048).optional(),
    }),
  )
  .handler(async ({ data }): Promise<FoundingRunResult> => {
    const f = await import("@/lib/api/founding");
    const WORKER_URL = process.env.LEGIBILITY_EXTRACTOR_URL;
    const WORKER_TOKEN = process.env.LEGIBILITY_EXTRACTOR_TOKEN;
    const idKey = process.env.EXPORT_ID_KEY;
    if (!WORKER_URL || !WORKER_TOKEN || !idKey) return { ok: false, message: f.REFUSALS.paused };

    const parsed = f.parseFoundingForm(data);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    const form = parsed.form;

    const ctx = await requestContext();
    if (!(await f.verifyTurnstile(data.token, process.env.TURNSTILE_SECRET_KEY, ctx.ip))) {
      return { ok: false, message: f.REFUSALS.challenge };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claim = await supabaseAdmin.rpc("claim_founding_run", {
      _ip_hash: f.ipHash(ctx.ip, idKey),
      _domain: form.input.domain,
      _per_ip: f.FOUNDING_LIMITS.perIpPerDay,
      _per_domain: f.FOUNDING_LIMITS.perDomainPerDay,
      _per_day: f.FOUNDING_LIMITS.runsPerDay,
      _cost_ceiling_usd: f.FOUNDING_LIMITS.costCeilingUsdPerDay,
    });
    const c = claim.data?.[0];
    if (claim.error || !c) return { ok: false, message: f.REFUSALS.paused };
    if (!c.allowed || !c.run_id) return { ok: false, message: f.refusalFor(c.reason) };

    await event("testbench_started", ctx.source);

    let status = 502;
    let text = "";
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${WORKER_TOKEN}` },
        body: JSON.stringify(
          form.input.kind === "url" ? { url: form.input.value } : { gtin: form.input.value },
        ),
        signal: AbortSignal.timeout(25000),
      });
      text = await res.text();
      status = res.status;
    } catch {
      /* upstream failure */
    }

    const { stampFromResponse } = await import("@/lib/api/meter");
    const stamp = stampFromResponse(
      text,
      form.input.kind === "url" ? { url: form.input.value } : { gtin: form.input.value },
    );
    await supabaseAdmin.rpc("complete_founding_run", {
      _run_id: c.run_id,
      _status: status === 200 ? "done" : "failed",
      _cost_usd: stamp.cost_usd,
    });
    if (status !== 200)
      return {
        ok: false,
        message:
          "The test could not reach the reader just now. Nothing has been charged. Try again in a minute.",
      };
    await event("testbench_completed", ctx.source);

    let envelope: Record<string, unknown> | null = null;
    try {
      const v = JSON.parse(text);
      if (v && typeof v === "object" && !Array.isArray(v)) envelope = v as Record<string, unknown>;
    } catch {
      envelope = null;
    }
    const trusted = f.isTrusted(stamp);
    const { data: entry, error } = await supabaseAdmin
      .from("founding_entries")
      .insert({
        run_id: c.run_id,
        use_case: form.use_case,
        interface: form.interface,
        stores: form.stores,
        input_kind: form.input.kind,
        input: form.input.value,
        real_input: f.isRealInput(form.input),
        trusted,
        result: envelope as never,
        source: ctx.source,
      })
      .select("id")
      .single();
    if (error || !entry) return { ok: false, message: f.REFUSALS.paused };
    return { ok: true, entryId: entry.id, trusted, report: f.reportFrom(envelope) };
  });

/** The email step was submitted: founding_200_submitted, once per entry. */
export const submitFoundingEntry = createServerFn({ method: "POST" })
  .inputValidator(z.object({ entryId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("founding_entries")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", data.entryId)
      .is("submitted_at", null)
      .select("source");
    const row = rows?.[0];
    if (row) await event("founding_200_submitted", row.source);
    return { ok: true };
  });

export type FoundingWelcome =
  | { ok: false; message: string }
  | {
      ok: true;
      key: string | null;
      keyHint: string | null;
      trusted: boolean;
      input: { kind: "url" | "gtin"; value: string };
      report: import("@/lib/api/founding").FoundingReport;
      contact: string | null;
    };

/** After verification: link the entry, issue the key once, and hand back the report. */
export const claimFoundingEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entryId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<FoundingWelcome> => {
    const userId = (context as { userId: string }).userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claimed = await supabaseAdmin.rpc("claim_founding_entry", {
      _entry_id: data.entryId,
      _account_id: userId,
    });
    if (claimed.error || claimed.data !== true) {
      return {
        ok: false,
        message:
          "This link has expired or belongs to another account. Run the test again to start over.",
      };
    }
    const { data: entry } = await supabaseAdmin
      .from("founding_entries")
      .select("input_kind, input, trusted, result")
      .eq("id", data.entryId)
      .single();
    if (!entry) return { ok: false, message: "That entry could not be found." };

    const ctx = await requestContext();
    const { issueKey } = await import("@/integrations/supabase/api-keys.server");
    const issued = await issueKey(userId, "founding-200", ctx.cookie);
    let keyHint: string | null = null;
    if (!issued) {
      const { data: active } = await supabaseAdmin
        .from("api_keys")
        .select("prefix, last_four")
        .eq("user_id", userId)
        .is("revoked_at", null)
        .limit(1);
      const k = active?.[0];
      keyHint = k ? `${k.prefix}...${k.last_four}` : null;
    }
    // A8: only when Krish has chosen automatic capped trials for sign-ups (FOUNDING_AUTO_TRIAL),
    // a new key comes with the default trial. Otherwise it is a Free key and a trial is his
    // click on the Trials tab. A second grant is refused by the database, so this is safe to
    // reach twice.
    if (issued) {
      const { autoTrialEnabled, trialFuseCents, TRIAL_DEFAULTS } = await import("@/lib/api/trial");
      if (autoTrialEnabled(process.env)) {
        const m = (await supabaseAdmin.rpc("trial_cost_per_call")).data?.[0];
        const { touchFromCookie } = await import("@/lib/api/attribution");
        const { error: grantError } = await supabaseAdmin.rpc("grant_trial", {
          _account_id: userId,
          _allowance: TRIAL_DEFAULTS.allowance,
          _days: TRIAL_DEFAULTS.days,
          _cost_fuse_cents: trialFuseCents(
            TRIAL_DEFAULTS.allowance,
            m ? { calls: Number(m.calls), avg_usd: m.avg_usd, p95_usd: m.p95_usd } : null,
          ),
          _invitation_id: touchFromCookie(ctx.cookie, new Date())?.invitation_id ?? null,
          _granted_by: null,
        });
        if (grantError) console.error("[founding] automatic trial not granted", grantError.code);
      }
    }
    const { contactFrom } = await import("@/lib/api/mcp-tools");
    return {
      ok: true,
      key: issued?.key ?? null,
      keyHint,
      trusted: entry.trusted,
      input: { kind: entry.input_kind as "url" | "gtin", value: entry.input },
      report: (await import("@/lib/api/founding")).reportFrom(entry.result),
      // A call is offered only to a fit entrant, and only by reply to a role address.
      contact: entry.trusted ? contactFrom(process.env) : null,
    };
  });
