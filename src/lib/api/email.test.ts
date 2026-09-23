import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, renderVerdictEmail, sendEmail, type VerdictEmailInput } from "./email";
import { REASON_COPY, REASON_FIX } from "./readability";

/**
 * The email is the first thing this product has ever actually sent. Before it, the capture
 * form said "We will be in touch" with no provider wired and nothing to send, which is the
 * kind of unbacked claim a page arguing for honest measurement cannot make.
 *
 * So what is tested is that it says the same thing the result card said, that hostile input
 * cannot break out of the markup, and that a provider failure is reported rather than thrown
 * at a visitor whose capture already succeeded.
 */

const ORIGIN = "https://legibility.io";

const UNREADABLE: VerdictEmailInput = {
  host: "example.com",
  readable: false,
  reason: "js_shell",
  method: "none",
  detail: "40000B of HTML, only 120B of readable text",
  checked_at: "2026-09-23T12:00:00.000Z",
};

const READABLE: VerdictEmailInput = {
  host: "example.com",
  readable: true,
  reason: null,
  method: "jsonld",
  detail: "2 JSON-LD blocks",
  checked_at: "2026-09-23T12:00:00.000Z",
};

describe("escapeHtml", () => {
  it("escapes every character that could break out of an attribute or a text node", () => {
    expect(escapeHtml(`<script>"'&`)).toBe("&lt;script&gt;&quot;&#39;&amp;");
  });

  it("escapes the ampersand first, so an escape is not double-escaped", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("renderVerdictEmail", () => {
  it("states the finding in the subject rather than withholding it", () => {
    expect(renderVerdictEmail(UNREADABLE, ORIGIN).subject).toBe(
      "A machine cannot read example.com.",
    );
    expect(renderVerdictEmail(READABLE, ORIGIN).subject).toBe("A machine can read example.com.");
  });

  it("carries the same gloss the result card showed", () => {
    const { text, html } = renderVerdictEmail(UNREADABLE, ORIGIN);
    expect(text).toContain(REASON_COPY.js_shell);
    expect(html).toContain(escapeHtml(REASON_COPY.js_shell));
  });

  it("tells an unreadable site what would change it", () => {
    const { text } = renderVerdictEmail(UNREADABLE, ORIGIN);
    expect(text).toContain(REASON_FIX.js_shell);
  });

  it("does not invent a problem for a readable site", () => {
    const { text } = renderVerdictEmail(READABLE, ORIGIN);
    expect(text).toContain("we would rather say so than invent a problem");
    expect(text).not.toContain("What would change it");
  });

  it("falls back honestly when an unreadable verdict carries no reason", () => {
    // The route rejects this shape and the table forbids it, so it cannot arrive here in
    // practice. It still must not render a blank paragraph if it ever does.
    const odd = { ...UNREADABLE, reason: null };
    const { text } = renderVerdictEmail(odd, ORIGIN);
    expect(text).toContain("The result was inconclusive.");
  });

  it("reports the verdict, method, evidence and time in both bodies", () => {
    const { text, html } = renderVerdictEmail(UNREADABLE, ORIGIN);
    for (const body of [text, html]) {
      expect(body).toContain("example.com");
      expect(body).toContain("js_shell");
      expect(body).toContain("2026-09-23 12:00 UTC");
    }
    expect(text).toContain(UNREADABLE.detail);
    expect(html).toContain(escapeHtml(UNREADABLE.detail));
  });

  it("names the verdict as readable rather than as a reason when the page reads", () => {
    expect(renderVerdictEmail(READABLE, ORIGIN).text).toContain("verdict   readable");
  });

  it("points at the bot page and the method section", () => {
    const { text, html } = renderVerdictEmail(UNREADABLE, ORIGIN);
    expect(text).toContain(`${ORIGIN}/about/bot`);
    expect(html).toContain(`${ORIGIN}/about/bot`);
    expect(html).toContain(`${ORIGIN}/#method`);
  });

  it("escapes a hostile host and evidence string in the HTML body", () => {
    const hostile: VerdictEmailInput = {
      ...UNREADABLE,
      host: "<img src=x onerror=alert(1)>",
      detail: '"><script>alert(1)</script>',
    };
    const { html } = renderVerdictEmail(hostile, ORIGIN);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;img src=x");
  });

  it("says why the address is receiving it", () => {
    const { text, html } = renderVerdictEmail(UNREADABLE, ORIGIN);
    expect(text).toContain("because you asked for this read");
    expect(html).toContain("because you asked for this read");
  });
});

describe("sendEmail", () => {
  const rendered = { subject: "s", text: "t", html: "<p>h</p>" };
  const opts = { apiKey: "re_test", from: "Legibility <hello@legibility.io>" };

  afterEach(() => vi.unstubAllGlobals());

  it("posts the rendered email to Resend with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendEmail("a@b.com", rendered, opts)).resolves.toEqual({ sent: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ from: opts.from, to: ["a@b.com"], subject: "s" });
    expect(body.reply_to).toBeUndefined();
  });

  it("includes reply_to only when one is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail("a@b.com", rendered, { ...opts, replyTo: "hello@legibility.io" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBe("hello@legibility.io");
  });

  it("reports a provider rejection instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("domain not verified", { status: 403 })),
    );
    const result = await sendEmail("a@b.com", rendered, opts);
    expect(result.sent).toBe(false);
    expect(result.error).toContain("resend 403");
    expect(result.error).toContain("domain not verified");
  });

  it("reports a rejection whose body cannot be read", async () => {
    const res = new Response(null, { status: 500 });
    Object.defineProperty(res, "text", { value: () => Promise.reject(new Error("no body")) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
    const result = await sendEmail("a@b.com", rendered, opts);
    expect(result).toEqual({ sent: false, error: "resend 500: " });
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("econnreset")));
    await expect(sendEmail("a@b.com", rendered, opts)).resolves.toEqual({
      sent: false,
      error: "econnreset",
    });
  });

  it("reports a non-Error rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("nope"));
    await expect(sendEmail("a@b.com", rendered, opts)).resolves.toEqual({
      sent: false,
      error: "send failed",
    });
  });
});
