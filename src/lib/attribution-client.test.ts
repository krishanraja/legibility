import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A2, test 7: with the network mocked, GA4 (gtag) and PostHog each receive generate_lead,
 * sign_up and test_run exactly once per action, and no payload carries an email, an IP, a
 * product input or a key. Plus the browser's cookie handling around a page load.
 */

const h = vi.hoisted(() => ({ claimSignUp: vi.fn() }));
vi.mock("@/lib/api/attribution.functions", () => ({ claimSignUp: h.claimSignUp }));

const { trackGrowth } = await import("./analytics");
const { currentTouch, recordLanding, reportSignUp } = await import("./attribution-client");

// Synthetic only.
const INV = "legibility:wave-1:synthetic.0001";
const ADDRESS = ["someone", "example.invalid"].join("@");

let gtag: ReturnType<typeof vi.fn>;
let ph: ReturnType<typeof vi.fn>;
let doc: { cookie: string; referrer: string };

function page(search: string, referrer = "") {
  doc = { cookie: "", referrer };
  vi.stubGlobal("window", { location: { search, protocol: "https:" } });
  vi.stubGlobal("document", doc);
}

beforeEach(() => {
  gtag = vi.fn();
  ph = vi.fn();
  vi.stubGlobal("gtag", gtag);
  vi.stubGlobal("posthog", { capture: ph });
  page("");
  h.claimSignUp.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

function everyPayload(): string {
  return JSON.stringify([...gtag.mock.calls, ...ph.mock.calls]);
}

describe("trackGrowth", () => {
  it.each(["generate_lead", "sign_up", "test_run"] as const)(
    "7. sends %s once to GA4 and once to PostHog, with the invitation id and label only",
    (event) => {
      trackGrowth(event, INV, "invitation");
      expect(gtag).toHaveBeenCalledTimes(1);
      expect(gtag).toHaveBeenCalledWith("event", event, {
        invitation_id: INV,
        channel: "invitation",
      });
      expect(ph).toHaveBeenCalledTimes(1);
      expect(ph).toHaveBeenCalledWith(event, { invitation_id: INV, channel: "invitation" });
    },
  );

  it("7. never carries an email, an IP, a product input or a key, even when handed one", () => {
    trackGrowth("generate_lead", ADDRESS, "192.168.0.1");
    trackGrowth("test_run", "lgk_synthetic_not_a_key", "https://shop.example.test/p/1");
    const payload = everyPayload();
    expect(payload).not.toContain("@");
    expect(payload).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(payload).not.toContain("lgk_");
    expect(payload).not.toContain("example.test");
  });

  it("survives a tracker that throws, and does nothing on the server", () => {
    vi.stubGlobal("gtag", () => {
      throw new Error("blocked");
    });
    vi.stubGlobal("posthog", {
      capture: () => {
        throw new Error("blocked");
      },
    });
    expect(() => trackGrowth("sign_up", null, "direct")).not.toThrow();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("gtag", gtag);
    trackGrowth("sign_up", null, "direct");
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("reportSignUp", () => {
  it("7. sends sign_up only when the server says this is the first verified session", async () => {
    h.claimSignUp.mockResolvedValueOnce({
      first: true,
      invitation_id: INV,
      channel: "introduction",
    });
    h.claimSignUp.mockResolvedValueOnce({
      first: false,
      invitation_id: INV,
      channel: "introduction",
    });
    await reportSignUp();
    await reportSignUp();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "sign_up", {
      invitation_id: INV,
      channel: "introduction",
    });
    expect(ph).toHaveBeenCalledTimes(1);
  });

  it("never throws when the server call fails", async () => {
    h.claimSignUp.mockRejectedValueOnce(new Error("offline"));
    await expect(reportSignUp()).resolves.toBeUndefined();
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("the landing cookie", () => {
  it("a tagged landing stores a 30-day first-party touch the page can read back", () => {
    page(`?utm_source=outreach&utm_medium=email&utm_content=${encodeURIComponent(INV)}`);
    recordLanding();
    expect(doc.cookie).toMatch(/^lg_touch=/);
    expect(doc.cookie).toContain("Max-Age=2592000");
    expect(doc.cookie).toContain("Secure");
    // A browser's document.cookie returns name=value pairs only.
    doc.cookie = doc.cookie.split(";")[0];
    expect(currentTouch()).toMatchObject({ invitation_id: INV, utm_source: "outreach" });
  });

  it("8. a plain visit stores nothing and leaves an earlier touch alone", () => {
    page("", "https://example.test/");
    recordLanding();
    expect(doc.cookie).toBe("");
    expect(currentTouch()).toBeNull();
  });

  it("never throws, in the browser or on the server", () => {
    vi.stubGlobal("window", { location: null });
    expect(() => recordLanding()).not.toThrow();
    vi.stubGlobal("document", {
      get cookie() {
        throw new Error("blocked");
      },
    });
    expect(currentTouch()).toBeNull();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    expect(() => recordLanding()).not.toThrow();
    expect(currentTouch()).toBeNull();
  });
});
