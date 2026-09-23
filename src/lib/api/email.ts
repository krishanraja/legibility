// Transactional email, over the Resend HTTP API.
//
// No SDK. The whole surface used here is one POST with a bearer token, and the repo already
// hand-rolls Stripe signature verification and the MCP JSON-RPC server rather than take a
// dependency for something this size.
//
// What it sends is the verdict the visitor just saw, not a newsletter and not a promise of
// one. Before this existed the capture form said "We will be in touch" and nothing was ever
// sent, which is the kind of claim this product cannot afford to make loosely. The email is
// deliverable with no new capability, because the thing worth sending is the read itself.
import { REASON_COPY, REASON_FIX, type FailureReason } from "./readability";

export type VerdictEmailInput = {
  host: string;
  readable: boolean;
  reason: FailureReason | null;
  method: string;
  detail: string;
  checked_at: string;
};

export type RenderedEmail = { subject: string; text: string; html: string };

/** Escape for interpolation into the HTML body. Every field below is attacker-influenced. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build the email for one verdict.
 *
 * Pure, so the wording is testable without a network. The subject states the finding rather
 * than teasing it: someone scanning an inbox should be able to act without opening this, and
 * a subject line that withholds the answer to make them open it is the register the front
 * page spent its whole copy budget avoiding.
 */
export function renderVerdictEmail(v: VerdictEmailInput, origin: string): RenderedEmail {
  const verdictLine = v.readable
    ? `A machine can read ${v.host}.`
    : `A machine cannot read ${v.host}.`;

  const explanation = v.readable
    ? `Structured data was found and parsed. Method: ${v.method}. This is the good outcome, and we would rather say so than invent a problem.`
    : (v.reason && REASON_COPY[v.reason]) || "The result was inconclusive.";

  const fix = v.readable ? null : v.reason && REASON_FIX[v.reason];

  const checked = v.checked_at.slice(0, 16).replace("T", " ") + " UTC";

  const text = [
    verdictLine,
    "",
    explanation,
    ...(fix ? ["", "What would change it:", fix] : []),
    "",
    "The read:",
    `  host      ${v.host}`,
    `  verdict   ${v.readable ? "readable" : (v.reason ?? "unknown")}`,
    `  method    ${v.method}`,
    `  evidence  ${v.detail}`,
    `  checked   ${checked}`,
    "",
    "This is one page, read once, with one plain request. We do not run a headless",
    "browser and we do not route around a refusal, because a site being unreadable",
    "without those is the finding.",
    "",
    `What the bot does: ${origin}/about/bot`,
    `Method and its limits: ${origin}/#method`,
    "",
    "You are receiving this because you asked for this read at legibility.io.",
    "It is the only email this address gets unless you ask for another one.",
  ].join("\n");

  const row = (k: string, val: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#6b6b6b;font:12px ui-monospace,monospace">${escapeHtml(k)}</td><td style="padding:4px 0;color:#1f2933;font:12px ui-monospace,monospace">${escapeHtml(val)}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f1ec;font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2933">
<div style="max-width:560px;margin:0 auto">
<p style="font:11px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#b4542a;margin:0 0 20px">Legibility</p>
<h1 style="font-size:26px;line-height:1.2;font-weight:400;margin:0 0 16px">${escapeHtml(verdictLine)}</h1>
<p style="line-height:1.6;color:#4a5361;margin:0 0 16px">${escapeHtml(explanation)}</p>
${fix ? `<p style="line-height:1.6;color:#1f2933;margin:0 0 16px"><strong style="font-weight:600">What would change it.</strong> ${escapeHtml(fix)}</p>` : ""}
<table style="border-collapse:collapse;border-top:1px solid #ded8cf;border-bottom:1px solid #ded8cf;margin:24px 0;width:100%">
${row("host", v.host)}
${row("verdict", v.readable ? "readable" : (v.reason ?? "unknown"))}
${row("method", v.method)}
${row("evidence", v.detail)}
${row("checked", checked)}
</table>
<p style="line-height:1.6;color:#6b6b6b;font-size:13px;margin:0 0 16px">This is one page, read once, with one plain request. We do not run a headless browser and we do not route around a refusal, because a site being unreadable without those is the finding.</p>
<p style="line-height:1.6;font-size:13px;margin:0 0 24px"><a href="${escapeHtml(origin)}/about/bot" style="color:#b4542a">What the bot does</a> &middot; <a href="${escapeHtml(origin)}/#method" style="color:#b4542a">Method and its limits</a></p>
<p style="line-height:1.5;color:#8a8a8a;font-size:11px;margin:0;border-top:1px solid #ded8cf;padding-top:16px">You are receiving this because you asked for this read at legibility.io. It is the only email this address gets unless you ask for another one.</p>
</div></body></html>`;

  return { subject: verdictLine, text, html };
}

export type SendResult = { sent: boolean; error?: string };

/**
 * Send one rendered email.
 *
 * Never throws. The caller has already written the record and the waitlist row by the time
 * this runs, and a mail provider having a bad minute is not a reason to tell the visitor
 * their capture failed and make them submit again. The outcome is returned so the caller can
 * report it honestly rather than claim a send that did not happen.
 */
export async function sendEmail(
  to: string,
  rendered: RenderedEmail,
  opts: { apiKey: string; from: string; replyTo?: string },
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from,
        to: [to],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
