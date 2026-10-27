import { describe, expect, it } from "vitest";

import {
  DIRECTORIES,
  DIRECTORY_HOSTS,
  TOUCH_COOKIE,
  TOUCH_MAX_AGE_SECONDS,
  channelLabel,
  directoryForHost,
  firstProductToken,
  growthEventParams,
  invitationId,
  landingTouch,
  mcpClientName,
  referrerHost,
  serializeTouch,
  touchCookie,
  touchFromCookie,
  utmValue,
  type Touch,
} from "./attribution";

// Synthetic values throughout: no real invitation, campaign, person or address.
const NOW = new Date("2026-10-28T09:58:00.000Z");
const INV = "legibility:wave-1:synthetic.0001";

function touch(over: Partial<Touch> = {}): Touch {
  return {
    invitation_id: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    referrer_host: null,
    directory: null,
    touched_at: NOW.toISOString(),
    ...over,
  };
}

describe("invitationId", () => {
  it("keeps an id in the engine's shape", () => {
    expect(invitationId(INV)).toBe(INV);
  });

  it("2. drops an id over 120 characters or with a disallowed character", () => {
    expect(invitationId(`legibility:${"a".repeat(109)}`)).toHaveLength(120);
    expect(invitationId(`legibility:${"a".repeat(110)}`)).toBeNull();
    expect(invitationId("legibility:has space")).toBeNull();
    expect(invitationId("legibility:a/b")).toBeNull();
    expect(invitationId("legibility:")).toBeNull();
    expect(invitationId("other:abc")).toBeNull();
    expect(invitationId(42)).toBeNull();
  });
});

describe("utmValue", () => {
  it("lowercases and trims", () => {
    expect(utmValue("  Wave-1 ")).toBe("wave-1");
  });

  it("drops anything over 100 characters, empty, or with other characters", () => {
    expect(utmValue("a".repeat(100))).toHaveLength(100);
    expect(utmValue("a".repeat(101))).toBeNull();
    expect(utmValue("")).toBeNull();
    expect(utmValue("-lead")).toBeNull();
    expect(utmValue("a b")).toBeNull();
    expect(utmValue(null)).toBeNull();
  });

  it("refuses an IPv4 address anywhere in a value", () => {
    expect(utmValue("10.0.0.1")).toBeNull();
    expect(utmValue("from-10.0.0.1-x")).toBeNull();
    expect(utmValue("v1.2.3")).toBe("v1.2.3");
  });
});

describe("referrerHost", () => {
  it("3. keeps the host only, never the path or query", () => {
    expect(referrerHost("https://Example.TEST/some/path?q=private#x")).toBe("example.test");
  });

  it("ignores our own host and its subdomains, and anything unparseable", () => {
    expect(referrerHost("https://legibility.io/docs")).toBeNull();
    expect(referrerHost("https://www.legibility.io/")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
    expect(referrerHost("")).toBeNull();
    expect(referrerHost(undefined)).toBeNull();
    expect(referrerHost("http://[::1]/")).toBeNull();
    expect(referrerHost("http://10.0.0.1:8080/x")).toBeNull();
  });
});

describe("directoryForHost", () => {
  it("knows one host per directory, and its subdomains", () => {
    for (const d of DIRECTORIES) {
      expect(directoryForHost(DIRECTORY_HOSTS[d])).toBe(d);
      expect(directoryForHost(`www.${DIRECTORY_HOSTS[d]}`)).toBe(d);
    }
    expect(directoryForHost("notsmithery.ai")).toBeNull();
    expect(directoryForHost(null)).toBeNull();
  });
});

describe("landingTouch", () => {
  it("1. reads all four utm values, with the invitation id from utm_content", () => {
    const t = landingTouch({
      search: `?utm_source=Outreach&utm_medium=email&utm_campaign=wave-1&utm_content=${encodeURIComponent(INV)}`,
      referrer: "",
      now: NOW,
    });
    expect(t).toEqual(
      touch({
        invitation_id: INV,
        utm_source: "outreach",
        utm_medium: "email",
        utm_campaign: "wave-1",
      }),
    );
    expect(channelLabel(t)).toBe("invitation");
  });

  it("2. drops a utm_content that is not an invitation id but keeps the rest", () => {
    const t = landingTouch({
      search: `?utm_source=outreach&utm_content=${"x".repeat(130)}`,
      referrer: null,
      now: NOW,
    });
    expect(t?.invitation_id).toBeNull();
    expect(t?.utm_source).toBe("outreach");
  });

  it("3. keeps the referrer's host only", () => {
    const t = landingTouch({
      search: "?utm_source=newsletter",
      referrer: "https://news.example.test/issue/9?reader=private",
      now: NOW,
    });
    expect(t?.referrer_host).toBe("news.example.test");
    expect(JSON.stringify(t)).not.toContain("private");
  });

  it("recognises a directory by its referrer with no tags", () => {
    const t = landingTouch({ search: "", referrer: "https://smithery.ai/server/x", now: NOW });
    expect(t?.directory).toBe("smithery");
    expect(channelLabel(t)).toBe("directory:smithery");
  });

  it("recognises a directory by our own listing tags", () => {
    const t = landingTouch({
      search: "?utm_medium=directory&utm_source=glama",
      referrer: "",
      now: NOW,
    });
    expect(t?.directory).toBe("glama");
  });

  it("does not treat utm_medium=directory with an unknown source as a directory", () => {
    const t = landingTouch({
      search: "?utm_medium=directory&utm_source=elsewhere",
      referrer: "",
      now: NOW,
    });
    expect(t?.directory).toBeNull();
    expect(channelLabel(t)).toBe("utm:elsewhere");
  });

  it("8. stores nothing with no tags and no recognised referrer", () => {
    expect(landingTouch({ search: "", referrer: "", now: NOW })).toBeNull();
    expect(
      landingTouch({ search: "?q=1", referrer: "https://example.test/", now: NOW }),
    ).toBeNull();
  });

  it("stores nothing when every tag present is invalid", () => {
    expect(landingTouch({ search: "?utm_content=bad&utm_term=x", referrer: "", now: NOW })).toBe(
      null,
    );
  });
});

describe("channelLabel", () => {
  it("follows the brief's order", () => {
    expect(channelLabel(null)).toBe("direct");
    expect(channelLabel(touch())).toBe("direct");
    expect(channelLabel(touch({ invitation_id: INV, utm_medium: "introduction" }))).toBe(
      "introduction",
    );
    expect(channelLabel(touch({ invitation_id: INV, utm_medium: "email" }))).toBe("invitation");
    expect(channelLabel(touch({ directory: "pulsemcp", utm_source: "x" }))).toBe(
      "directory:pulsemcp",
    );
    expect(channelLabel(touch({ utm_source: "x", referrer_host: "example.test" }))).toBe("utm:x");
    expect(channelLabel(touch({ referrer_host: "example.test" }))).toBe("referrer:example.test");
  });

  it("is never longer than 80 characters", () => {
    expect(channelLabel(touch({ utm_source: "a".repeat(100) }))).toHaveLength(80);
  });
});

describe("the touch cookie", () => {
  const full = touch({
    invitation_id: INV,
    utm_source: "outreach",
    utm_medium: "introduction",
    utm_campaign: "wave-1",
    referrer_host: "example.test",
    directory: "smithery",
  });

  it("round-trips", () => {
    const header = `other=1; ${TOUCH_COOKIE}=${serializeTouch(full)}; more=2`;
    expect(touchFromCookie(header, NOW)).toEqual(full);
  });

  it("is first-party, 30 days, Lax, and Secure on https", () => {
    const c = touchCookie(full, true);
    expect(c).toContain(`Max-Age=${TOUCH_MAX_AGE_SECONDS}`);
    expect(TOUCH_MAX_AGE_SECONDS).toBe(2_592_000);
    expect(c).toContain("Path=/");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    expect(c).not.toContain("Domain=");
    expect(touchCookie(full, false)).not.toContain("Secure");
  });

  it("re-validates every field, because a cookie is input", () => {
    const forged = encodeURIComponent(
      JSON.stringify({
        invitation_id: "legibility:ok",
        utm_source: "A B",
        utm_medium: "email",
        utm_campaign: 5,
        referrer_host: "10.0.0.1",
        directory: "nowhere",
        touched_at: NOW.toISOString(),
      }),
    );
    expect(touchFromCookie(`${TOUCH_COOKIE}=${forged}`, NOW)).toEqual(
      touch({ invitation_id: "legibility:ok", utm_medium: "email" }),
    );
  });

  it("is no touch when missing, malformed, empty, future or older than 30 days", () => {
    const at = (iso: unknown) =>
      `${TOUCH_COOKIE}=${encodeURIComponent(JSON.stringify({ utm_source: "x", touched_at: iso }))}`;
    expect(touchFromCookie(null, NOW)).toBeNull();
    expect(touchFromCookie("", NOW)).toBeNull();
    expect(touchFromCookie("other=1", NOW)).toBeNull();
    expect(touchFromCookie(`${TOUCH_COOKIE}=%E0%A4%A`, NOW)).toBeNull();
    expect(touchFromCookie(`${TOUCH_COOKIE}=null`, NOW)).toBeNull();
    expect(touchFromCookie(`${TOUCH_COOKIE}=${serializeTouch(touch())}`, NOW)).toBeNull();
    expect(touchFromCookie(at("2026-10-29T00:00:00Z"), NOW)).toBeNull();
    expect(touchFromCookie(at("2026-09-27T00:00:00Z"), NOW)).toBeNull();
    expect(touchFromCookie(at("yesterday"), NOW)).toBeNull();
    expect(touchFromCookie(at(7), NOW)).toBeNull();
    expect(touchFromCookie(at("2026-10-01T00:00:00Z"), NOW)?.utm_source).toBe("x");
  });
});

describe("clients", () => {
  it("6. keeps only the User-Agent's first product token, without its version", () => {
    expect(firstProductToken("curl/8.4.0")).toBe("curl");
    expect(firstProductToken("python-requests/2.32.3 extra")).toBe("python-requests");
    expect(firstProductToken("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")).toBe("Mozilla");
    expect(firstProductToken("  node ")).toBe("node");
    expect(firstProductToken("(weird)")).toBeNull();
    expect(firstProductToken("")).toBeNull();
    expect(firstProductToken(null)).toBeNull();
  });

  it("6. keeps an MCP clientInfo.name when it is a plain name", () => {
    expect(mcpClientName(" Example Client ")).toBe("Example Client");
    expect(mcpClientName("example-mcp/1.2")).toBe("example-mcp/1.2");
    expect(mcpClientName("a".repeat(101))).toBeNull();
    expect(mcpClientName("<script>")).toBeNull();
    expect(mcpClientName(["x"])).toBeNull();
  });
});

describe("growthEventParams", () => {
  it("carries the invitation id and the channel label only", () => {
    expect(growthEventParams(INV, "invitation")).toEqual({
      invitation_id: INV,
      channel: "invitation",
    });
    expect(growthEventParams(null, "direct")).toEqual({ channel: "direct" });
  });

  it("drops a malformed id and falls back to direct for a malformed label", () => {
    expect(growthEventParams("not-an-id", "Has Space")).toEqual({ channel: "direct" });
    expect(growthEventParams(undefined, undefined)).toEqual({ channel: "direct" });
    expect(growthEventParams(null, "10.0.0.1")).toEqual({ channel: "direct" });
    expect(growthEventParams(null, "referrer:10.0.0.1")).toEqual({ channel: "direct" });
    expect(growthEventParams(null, "made-up")).toEqual({ channel: "direct" });
    expect(growthEventParams(null, "directory:smithery")).toEqual({
      channel: "directory:smithery",
    });
  });
});
