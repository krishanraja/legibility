import { describe, expect, it } from "vitest";
import { classify, isAllowedByRobots, normaliseDomainInput } from "./readability";

/**
 * These two functions decide what the index says in public about a named company, so they
 * are tested harder than their size suggests. A wrong `blocked` is an accusation; a wrong
 * `readable` is a missed finding; a wrong robots verdict is a crawl we had no right to make.
 */

describe("isAllowedByRobots: groups are not additive", () => {
  // The bug this repo already shipped once in its own robots.txt: a named agent's group
  // replaces the "*" group outright, it does not inherit from it.
  const ROBOTS = `
User-agent: *
Disallow: /private

User-agent: LegibilityBot
Allow: /
`.trim();

  it("uses the specific group and ignores the wildcard's Disallow", () => {
    expect(isAllowedByRobots(ROBOTS, "/private", "LegibilityBot/0.1")).toBe(true);
  });

  it("applies the wildcard group to an agent with no group of its own", () => {
    expect(isAllowedByRobots(ROBOTS, "/private", "SomeOtherBot/1.0")).toBe(false);
  });

  it("allows a path no rule matches", () => {
    expect(isAllowedByRobots(ROBOTS, "/public", "SomeOtherBot/1.0")).toBe(true);
  });
});

describe("isAllowedByRobots: rule precedence", () => {
  it("lets the longest matching rule win, not the first", () => {
    const r = "User-agent: *\nDisallow: /a\nAllow: /a/b";
    expect(isAllowedByRobots(r, "/a/b/c", "Bot/1")).toBe(true);
    expect(isAllowedByRobots(r, "/a/z", "Bot/1")).toBe(false);
  });

  it("prefers Allow when two rules tie on length", () => {
    const r = "User-agent: *\nDisallow: /x\nAllow: /x";
    expect(isAllowedByRobots(r, "/x", "Bot/1")).toBe(true);
  });

  it("treats a valueless Disallow as permitting everything", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow:", "/anything", "Bot/1")).toBe(true);
  });

  it("blocks the whole site on Disallow: /", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow: /", "/", "Bot/1")).toBe(false);
  });

  it("ignores comments and blank lines", () => {
    const r = "# hello\n\nUser-agent: *\n# note\nDisallow: /no\n";
    expect(isAllowedByRobots(r, "/no", "Bot/1")).toBe(false);
  });

  it("permits when robots.txt is empty, which is what the standard says", () => {
    expect(isAllowedByRobots("", "/", "Bot/1")).toBe(true);
  });

  it("keeps a group open across a Sitemap line, per RFC 9309", () => {
    // Sitemap is a non-group record. It can appear anywhere and does NOT close the group,
    // so the Disallow after it still belongs to the wildcard group and still applies.
    // Written the other way round first, and this test caught it: reading Sitemap as a
    // terminator would silently drop every rule that follows one, which fails open and
    // would have us crawling paths we were told not to.
    const r = "User-agent: *\nAllow: /\nSitemap: https://x.test/s.xml\nDisallow: /everything";
    expect(isAllowedByRobots(r, "/everything", "Bot/1")).toBe(false);
  });

  it("starts a new group at the next User-agent, which does close the previous one", () => {
    const r = "User-agent: A\nDisallow: /\n\nUser-agent: B\nAllow: /";
    expect(isAllowedByRobots(r, "/x", "B/1")).toBe(true);
    expect(isAllowedByRobots(r, "/x", "A/1")).toBe(false);
  });
});

describe("classify: a refusal needs a second opinion", () => {
  it("records blocked when the refusal reproduced", () => {
    const c = classify(403, "<html>nope</html>", true);
    expect(c).toMatchObject({ readable: false, reason: "blocked" });
  });

  it("refuses to call it blocked when only one client saw the 403", () => {
    // Measured for real: node fetch got 403 from nytimes.com and theguardian.com while
    // curl got 200 and 302 seconds later. Recording that would have published a false
    // accusation against two newspapers.
    const c = classify(403, "<html>nope</html>", false);
    expect(c.reason).toBe("error");
    expect(c.detail).toContain("Inconclusive");
  });

  it("does not quietly downgrade an unconfirmed refusal to a softer failure", () => {
    // "error" is honest ignorance. Anything else would be picking the more interesting
    // story over the true one.
    expect(classify(429, "<html/>", false).reason).toBe("error");
    expect(classify(401, "<html/>", false).reason).toBe("error");
  });

  it.each([401, 403, 429])("treats %i as a refusal when confirmed", (s) => {
    expect(classify(s, "<html/>", true).reason).toBe("blocked");
  });
});

describe("classify: readable pages", () => {
  it("counts JSON-LD as readable and names the method", () => {
    const c = classify(200, '<script type="application/ld+json">{"@type":"Product"}</script>');
    expect(c).toMatchObject({ readable: true, reason: null, method: "jsonld" });
  });

  it("falls back to OpenGraph when there is no JSON-LD", () => {
    const html = '<meta property="og:title" content="x"><meta property="og:type" content="y">';
    expect(classify(200, html)).toMatchObject({ readable: true, method: "opengraph" });
  });

  it("does not accept a single og tag as structured data", () => {
    // One stray og:title is not a machine-readable description of the page.
    const c = classify(200, '<meta property="og:title" content="x">' + "prose ".repeat(200));
    expect(c.readable).toBe(false);
    expect(c.reason).toBe("no_structured_data");
  });

  it("prefers JSON-LD over OpenGraph when both are present", () => {
    const html =
      '<script type="application/ld+json">{}</script><meta property="og:title" content="x">' +
      '<meta property="og:type" content="y">';
    expect(classify(200, html).method).toBe("jsonld");
  });
});

describe("classify: distinguishing the failure modes", () => {
  it("calls a big HTML payload with almost no text a JS shell", () => {
    const html = "<div></div>".repeat(2000); // lots of markup, no prose
    const c = classify(200, html);
    expect(c.reason).toBe("js_shell");
  });

  it("does not count script and style contents as text", () => {
    // A shell whose bulk is an inline bundle would otherwise look like a rich document.
    const html = "<script>" + "var x=1;".repeat(2000) + "</script><div></div>";
    expect(classify(200, html).reason).toBe("js_shell");
  });

  it("calls prose without markup no_structured_data, not a shell", () => {
    const html = "<html><body><p>" + "real words here ".repeat(200) + "</p></body></html>";
    const c = classify(200, html);
    expect(c.reason).toBe("no_structured_data");
  });

  it("catches a 200 challenge interstitial before looking at the body", () => {
    // Cloudflare's interstitial is a well-formed page. Classified on its body alone it
    // would read as no_structured_data and understate a deliberate refusal.
    const c = classify(200, "<html><title>Just a moment...</title></html>");
    expect(c.reason).toBe("blocked");
    expect(c.detail).toContain("challenge");
  });

  it.each([500, 502, 503])("treats %i as error, never as a block", (s) => {
    // A server falling over is not a decision the site made about machine readers.
    expect(classify(s, "").reason).toBe("error");
  });

  it("treats 404 as error rather than a readability verdict", () => {
    expect(classify(404, "").reason).toBe("error");
  });
});

describe("classify: never contradicts the database constraint", () => {
  // observations has a check constraint that a readable row carries no failure reason and
  // an unreadable row carries one. If classify can emit a pair that violates it, the sweep
  // dies at insert time instead of at review time.
  const cases: [number, string][] = [
    [200, '<script type="application/ld+json">{}</script>'],
    [200, "<html><body>" + "words ".repeat(200) + "</body></html>"],
    [200, "<div></div>".repeat(500)],
    [403, "<html/>"],
    [500, ""],
    [404, ""],
    [200, "Just a moment..."],
  ];

  it.each(cases)("status %i produces a self-consistent verdict", (status, html) => {
    for (const confirmed of [true, false]) {
      const c = classify(status, html, confirmed);
      expect(c.readable ? c.reason === null : c.reason !== null).toBe(true);
    }
  });
});

describe("normaliseDomainInput: the SSRF front door", () => {
  // This feeds a public, unauthenticated endpoint that makes an outbound request on the
  // caller's behalf. Everything below is a way someone could try to aim it somewhere it
  // has no business going.

  it("accepts a bare domain and canonicalises it to https", () => {
    expect(normaliseDomainInput("allbirds.com")).toEqual({
      url: "https://allbirds.com/",
      host: "allbirds.com",
    });
  });

  it.each([
    "https://allbirds.com",
    "http://allbirds.com/deep/path?q=1",
    "  AllBirds.COM  ",
    "https://allbirds.com:443",
  ])("normalises %s to the same origin", (input) => {
    expect(normaliseDomainInput(input)).toMatchObject({ host: "allbirds.com" });
  });

  it("discards the path, so the checker always reads the homepage it claims to", () => {
    expect(normaliseDomainInput("https://allbirds.com/products/wool-runner")).toEqual({
      url: "https://allbirds.com/",
      host: "allbirds.com",
    });
  });

  it.each(["localhost", "foo.localhost", "printer.local", "db.internal", "box.localdomain"])(
    "refuses the internal host %s",
    (h) => {
      expect(normaliseDomainInput(h)).toHaveProperty("error");
    },
  );

  it.each(["127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.169.254", "8.8.8.8"])(
    "refuses the IP literal %s",
    (ip) => {
      // 169.254.169.254 is the cloud metadata endpoint, the classic SSRF target. Public
      // IPs are refused too: an IP is never a customer's marketing site, so allowing any
      // of them only widens the attack surface for no product benefit.
      expect(normaliseDomainInput(ip)).toEqual({
        error: "Enter a domain name, not an IP address.",
      });
    },
  );

  it("refuses IPv6 literals", () => {
    expect(normaliseDomainInput("http://[::1]/")).toHaveProperty("error");
  });

  it.each(["file:///etc/passwd", "gopher://x.com", "ftp://x.com", "javascript:alert(1)"])(
    "refuses the scheme in %s by name, not by accident",
    (u) => {
      expect(normaliseDomainInput(u)).toEqual({ error: "Only http and https are supported." });
    },
  );

  it("refuses a bare host that parses but has no hostname", () => {
    expect(normaliseDomainInput("https://")).toHaveProperty("error");
  });

  it("refuses a host that is only a dot", () => {
    expect(normaliseDomainInput(".")).toHaveProperty("error");
  });

  it("accepts a subdomain and a hyphenated label", () => {
    expect(normaliseDomainInput("shop.my-brand.co.uk")).toMatchObject({
      host: "shop.my-brand.co.uk",
    });
  });

  it("accepts explicit port 80 on http", () => {
    expect(normaliseDomainInput("http://example.com:80")).toMatchObject({ host: "example.com" });
  });

  it("refuses a non-default port, which would make this a port scanner", () => {
    expect(normaliseDomainInput("example.com:8080")).toEqual({
      error: "Only the default ports are supported.",
    });
  });

  it("refuses embedded credentials", () => {
    // userinfo can authenticate to an internal host that trusts it.
    expect(normaliseDomainInput("https://user:pass@internal.example.com/")).toHaveProperty("error");
  });

  it.each(["", "   ", "notadomain", "x", "example.com."])("refuses malformed input %p", (s) => {
    expect(normaliseDomainInput(s)).toHaveProperty("error");
  });

  it("refuses an over-long host", () => {
    expect(normaliseDomainInput("a".repeat(300) + ".com")).toHaveProperty("error");
  });

  it("refuses hosts with characters a real domain cannot have", () => {
    expect(normaliseDomainInput("exa mple.com")).toHaveProperty("error");
    expect(normaliseDomainInput("exa_mple.com/")).toHaveProperty("error");
  });
});

describe("isAllowedByRobots: malformed input does not crash or fail open", () => {
  it("ignores a line with no colon", () => {
    expect(
      isAllowedByRobots("this is not a directive\nUser-agent: *\nDisallow: /", "/", "B/1"),
    ).toBe(false);
  });

  it("ignores a rule that appears before any User-agent line", () => {
    // No group is open yet, so the orphan rule is dropped rather than attached to whatever
    // group happens to come next.
    expect(isAllowedByRobots("Disallow: /\nUser-agent: *\nAllow: /", "/", "B/1")).toBe(true);
  });

  it("merges consecutive User-agent lines into one group", () => {
    const r = "User-agent: A\nUser-agent: B\nDisallow: /shared";
    expect(isAllowedByRobots(r, "/shared", "A/1")).toBe(false);
    expect(isAllowedByRobots(r, "/shared", "B/1")).toBe(false);
  });

  it("keeps the first matching rule when a later rule is shorter", () => {
    // Exercises the "not longer, not an equal-length Allow" arm of the precedence test.
    const r = "User-agent: *\nDisallow: /a/b/c\nDisallow: /a";
    expect(isAllowedByRobots(r, "/a/b/c", "B/1")).toBe(false);
  });

  it("returns true when a group exists but no rule matches the path", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow: /admin", "/", "B/1")).toBe(true);
  });
});

describe("classify: singular and plural detail strings", () => {
  it("says block, singular, for exactly one JSON-LD script", () => {
    const c = classify(200, '<script type="application/ld+json">{}</script>');
    expect(c.detail).toBe("1 JSON-LD block");
  });

  it("says blocks, plural, for more than one", () => {
    const c = classify(
      200,
      '<script type="application/ld+json">{}</script><script type="application/ld+json">{}</script>',
    );
    expect(c.detail).toBe("2 JSON-LD blocks");
  });

  it("says tag, singular, when exactly one og tag is present", () => {
    const c = classify(200, '<meta property="og:title" content="x">' + "prose ".repeat(200));
    expect(c.detail).toContain("1 og: tag");
    expect(c.detail).not.toContain("og: tags");
  });

  it("says tags, plural, when none are present", () => {
    const c = classify(200, "<html><body>" + "prose ".repeat(200) + "</body></html>");
    expect(c.detail).toContain("0 og: tags");
  });
});
