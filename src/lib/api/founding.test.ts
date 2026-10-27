import { describe, expect, it, vi } from "vitest";

import { DEMO_GTIN } from "@/config/product";
import {
  COPY,
  FORBIDDEN_COPY,
  FOUNDING_LIMITS,
  REFUSALS,
  TURNSTILE_VERIFY_URL,
  curlFor,
  ipHash,
  isRealInput,
  isTrusted,
  mcpConfigFor,
  parseFoundingForm,
  parseFoundingInput,
  refusalFor,
  reportFrom,
  scrubFreeText,
  verificationOptions,
  verifyTurnstile,
} from "./founding";

// Synthetic only.
const KEY = "k".repeat(40);
const ENTRY = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("parseFoundingInput", () => {
  it("reads a product URL with its host as the domain", () => {
    expect(parseFoundingInput(" https://Shop.Example/products/a?b=1 ")).toEqual({
      kind: "url",
      value: "https://shop.example/products/a?b=1",
      domain: "shop.example",
    });
  });

  it("reads a barcode of 8, 12, 13 or 14 digits, ignoring spaces and dashes", () => {
    expect(parseFoundingInput("4006381333931")).toEqual({
      kind: "gtin",
      value: "4006381333931",
      domain: null,
    });
    expect(parseFoundingInput("0 12345-678905")?.value).toBe("012345678905");
    expect(parseFoundingInput("12345678")?.kind).toBe("gtin");
    expect(parseFoundingInput("12345678901234")?.kind).toBe("gtin");
  });

  it("refuses anything else", () => {
    for (const bad of [
      "",
      "123456789",
      "not a url",
      "ftp://shop.example/x",
      "https://localhost/x",
      "https://10.0.0.1/x",
      `https://shop.example/${"a".repeat(2050)}`,
      42,
    ]) {
      expect(parseFoundingInput(bad), String(bad)).toBeNull();
    }
  });

  it("a real input is anything but the demo barcode", () => {
    expect(isRealInput(parseFoundingInput(DEMO_GTIN)!)).toBe(false);
    expect(isRealInput(parseFoundingInput("4006381333931")!)).toBe(true);
    expect(isRealInput(parseFoundingInput("https://shop.example/p")!)).toBe(true);
  });
});

describe("parseFoundingForm", () => {
  it("keeps the four answers, trimmed, defaulting to REST", () => {
    expect(
      parseFoundingForm({
        input: "https://shop.example/p",
        use_case: "  a comparison agent ",
        stores: " Shopify ",
      }),
    ).toEqual({
      ok: true,
      form: {
        input: { kind: "url", value: "https://shop.example/p", domain: "shop.example" },
        use_case: "a comparison agent",
        interface: "rest",
        stores: "Shopify",
      },
    });
    const mcp = parseFoundingForm({ input: "12345678", interface: "mcp", use_case: 3 });
    expect(mcp.ok && mcp.form).toMatchObject({ interface: "mcp", use_case: "", stores: "" });
  });

  it("says what to fix", () => {
    expect(parseFoundingForm({ input: "nope" })).toEqual({
      ok: false,
      message: REFUSALS.invalid_input,
    });
    expect(parseFoundingForm({ input: "12345678", use_case: "a".repeat(2001) }).ok).toBe(false);
    expect(parseFoundingForm({ input: "12345678", stores: "a".repeat(501) }).ok).toBe(false);
  });
});

describe("refusals", () => {
  it("2 and 4. every refusal is plain and charges nobody; the ceiling says so", () => {
    expect(refusalFor("ip_limit")).toContain(String(FOUNDING_LIMITS.perIpPerDay));
    expect(refusalFor("cost_ceiling")).toContain("Nothing has been charged");
    expect(refusalFor("daily_runs")).toContain("Nothing has been charged");
    expect(refusalFor("domain_limit")).toContain("another site");
    expect(refusalFor("something new")).toBe(REFUSALS.paused);
  });
});

describe("ipHash", () => {
  it("is a keyed hash, never the address", () => {
    const h = ipHash("192.0.2.1", KEY);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(ipHash("192.0.2.1", KEY));
    expect(h).not.toBe(ipHash("192.0.2.2", KEY));
    expect(h).not.toBe(ipHash("192.0.2.1", "j".repeat(40)));
  });
});

describe("verifyTurnstile", () => {
  const ok = (success: unknown) =>
    vi.fn(async () => ({ json: async () => ({ success }) }) as unknown as Response);

  it("3. passes only when Cloudflare says the token is good", async () => {
    const f = ok(true);
    expect(await verifyTurnstile("tok", "secret", "192.0.2.1", f)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(String(init.body)).toContain("response=tok");
    expect(await verifyTurnstile("tok", "secret", "ip", ok(false))).toBe(false);
    expect(await verifyTurnstile("tok", "secret", "ip", ok("yes"))).toBe(false);
  });

  it("3. a run without the challenge, or without a secret, is refused", async () => {
    const f = ok(true);
    expect(await verifyTurnstile(undefined, "secret", "ip", f)).toBe(false);
    expect(await verifyTurnstile("", "secret", "ip", f)).toBe(false);
    expect(await verifyTurnstile("t".repeat(2049), "secret", "ip", f)).toBe(false);
    expect(await verifyTurnstile("tok", undefined, "ip", f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
    const broken = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await verifyTurnstile("tok", "secret", "ip", broken as unknown as typeof fetch)).toBe(
      false,
    );
  });
});

describe("the report and what to paste", () => {
  it("isTrusted is a product at or above the gate", () => {
    expect(isTrusted({ product_returned: true, confidence: 0.7 })).toBe(true);
    expect(isTrusted({ product_returned: true, confidence: 0.69 })).toBe(false);
    expect(isTrusted({ product_returned: false, confidence: 0.9 })).toBe(false);
    expect(isTrusted({ product_returned: true, confidence: null })).toBe(false);
  });

  it("6. the curl command carries the builder's own input and key", () => {
    const url = parseFoundingInput("https://shop.example/it's")!;
    const c = curlFor(url, "lgk_synthetic");
    expect(c).toContain("authorization: Bearer lgk_synthetic");
    expect(c).toContain(`'{"url":"https://shop.example/it'\\''s"}'`);
    expect(curlFor(parseFoundingInput("12345678")!, "k")).toContain('{"gtin":"12345678"}');
    expect(JSON.parse(mcpConfigFor("lgk_synthetic")).mcpServers.legibility).toEqual({
      url: "https://legibility.io/api/mcp",
      headers: { Authorization: "Bearer lgk_synthetic" },
    });
  });

  it("reportFrom shows the fields a builder checks, and copes with anything", () => {
    expect(
      reportFrom({
        product: {
          name: "Wool Runner",
          brand: "Brand",
          price: { low: 110, high: 120, currency: "USD" },
          availability: "in_stock",
        },
        confidence: 0.93,
        method: "shopify",
        cost_usd: 0.004,
        legibility_id: "pl_x",
      }),
    ).toEqual({
      title: "Wool Runner",
      brand: "Brand",
      price: { low: 110, high: 120, currency: "USD" },
      availability: "in_stock",
      confidence: 0.93,
      method: "shopify",
      cost_usd: 0.004,
      legibility_id: "pl_x",
    });
    expect(reportFrom(null)).toEqual({
      title: null,
      brand: null,
      price: null,
      availability: null,
      confidence: null,
      method: null,
      cost_usd: 0,
      legibility_id: null,
    });
    expect(reportFrom({ product: { title: "T", price: { low: "x" } } }).price).toEqual({
      low: null,
      high: null,
      currency: null,
    });
  });
});

describe("scrubFreeText", () => {
  it("removes addresses, URLs, IPs and barcodes", () => {
    const address = ["me", "example.invalid"].join("@");
    expect(
      scrubFreeText(
        `agent for ${address}, https://shop.example/p, www.shop.example, 192.0.2.1, 4006381333931 ok`,
      ),
    ).toBe("agent for [removed] [removed] [removed] [removed], [removed] ok");
    expect(scrubFreeText("a".repeat(2100))).toHaveLength(2000);
  });
});

describe("the verification email", () => {
  it("5. carries the entry id and the touch, and nothing the visitor typed", () => {
    const touch = {
      invitation_id: "legibility:x",
      utm_source: "outreach",
      utm_medium: "email",
      utm_campaign: null,
      referrer_host: null,
      directory: null,
      touched_at: "2026-10-28T09:58:00.000Z",
    };
    const o = verificationOptions("https://legibility.io", ENTRY, touch);
    expect(o).toEqual({
      emailRedirectTo: `https://legibility.io/founding-200?entry=${ENTRY}`,
      data: { founding_entry: ENTRY, attribution: touch },
    });
    expect(verificationOptions("https://legibility.io", ENTRY, null).data).toEqual({
      founding_entry: ENTRY,
    });
    const typed = ["https://shop.example/p", "a comparison agent", "Shopify"];
    for (const t of typed) expect(JSON.stringify(o)).not.toContain(t);
  });
});

describe("the words", () => {
  const all = [
    ...Object.values(COPY).map((v) => (typeof v === "function" ? v("role-address") : v)),
    ...Object.values(REFUSALS),
  ].join("\n");

  it("7. no booking link, no em dash, no mainnet claim, no promise beyond the offer", () => {
    for (const re of FORBIDDEN_COPY) expect(all, re.source).not.toMatch(re);
  });

  it("keeps free beside the trial and says what Free allows", () => {
    expect(COPY.offer).toContain("30-day free trial in exchange for feedback");
    expect(COPY.offer).toContain("up to 1,000 trusted reads a month");
  });

  it("the forbidden list catches what it names", () => {
    for (const bad of [
      "calendly.com/x",
      "cal.com/x",
      "Book a call",
      "schedule a demo",
      "mainnet",
      "unlimited reads",
      "we waive it",
      "$29",
      "priced from",
      "a \u2014 b",
    ]) {
      expect(
        FORBIDDEN_COPY.some((re) => re.test(bad)),
        bad,
      ).toBe(true);
    }
  });
});
