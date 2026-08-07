/**
 * The readability verdict: can a machine read this page, and if not, why not.
 *
 * This module is deliberately pure. It is shared by the scheduled cohort sweep
 * (scripts/sweep.ts) and by the public domain checker (src/routes/api/check.ts), because
 * the number published on the front page and the verdict shown to a visitor about their
 * own site must come from one implementation. Two implementations would drift, and the
 * first time they disagreed in public the index would be finished.
 *
 * Everything that touches the network lives in the callers. What is here is judgement, and
 * judgement is what gets tested.
 */

export type FailureReason =
  | "blocked"
  | "js_shell"
  | "no_structured_data"
  | "not_a_product"
  | "low_confidence"
  | "timeout"
  | "robots_disallowed"
  | "error";

export type Verdict = {
  readable: boolean;
  reason: FailureReason | null;
  method: string;
  detail: string;
};

/** Plain-English gloss for each reason, shown to a human looking at their own domain. */
export const REASON_COPY: Record<FailureReason, string> = {
  blocked: "The site refused the request. This is a choice the site made.",
  js_shell:
    "The page arrived, but its content is assembled by JavaScript. A crawler that does not run scripts sees an empty frame.",
  no_structured_data:
    "The page is readable as text but carries no structured data, so a machine has to guess what any of it means.",
  not_a_product: "The page was read successfully, but it is not a product page.",
  low_confidence:
    "The page was read, but the extraction did not clear the 0.7 trust gate, so it is not safe to rely on.",
  timeout: "The page did not answer in time.",
  robots_disallowed:
    "robots.txt asks machines not to read this path. Recorded as a data point, never circumvented.",
  error: "The result was inconclusive. We do not know, and we would rather say so.",
};

/**
 * Minimal robots.txt evaluation for a given user agent.
 *
 * Groups are NOT additive: the most specific matching group wins outright and the "*" group
 * is then ignored entirely. This repo shipped that backwards once in its own robots.txt,
 * letting every named AI crawler into /dashboard, so it is written out explicitly here
 * rather than approximated with a regex.
 *
 * Non-group records (Sitemap, Host) may appear anywhere and do NOT close a group, per
 * RFC 9309. Only a User-agent line after a rule starts a new one. Reading it the other way
 * would silently drop every rule after a Sitemap line, which fails open.
 *
 * An unreachable or empty robots.txt means permitted, which is what the standard says.
 */
export function isAllowedByRobots(robotsTxt: string, path: string, ua: string): boolean {
  const groups: { agents: string[]; rules: [string, string][] }[] = [];
  let current: { agents: string[]; rules: [string, string][] } | null = null;
  let lastWasAgent = false;

  for (const raw of robotsTxt.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      if (current) current.rules.push([field, value]);
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const token = ua.split("/")[0].toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const group = specific ?? wildcard;
  if (!group) return true;

  // Longest matching rule wins; Allow beats Disallow at equal length.
  let best: { allow: boolean; len: number } | null = null;
  for (const [field, value] of group.rules) {
    if (value === "") continue; // "Disallow:" with no value permits everything
    if (!path.startsWith(value)) continue;
    if (!best || value.length > best.len || (value.length === best.len && field === "allow")) {
      best = { allow: field === "allow", len: value.length };
    }
  }
  return best ? best.allow : true;
}

/**
 * Decide what a fetched page means.
 *
 * `refusalConfirmed` exists because a refusal is an accusation against a named company and
 * one client's word is not enough. Measured during development: a plain node fetch got 403
 * from nytimes.com and theguardian.com while curl got 200 and 302 from the same container
 * seconds apart. The difference was the HTTP client, not the sites. When a second
 * independent request path does not reproduce the refusal, the honest verdict is `error`,
 * not a softer failure: we do not know, and an index that cannot tell must say so rather
 * than pick the more interesting option.
 *
 * Order matters. A refusal is checked before anything about the body, because a 403 body is
 * often a well-formed challenge page that would otherwise classify as "no structured data"
 * and understate how deliberate the refusal was.
 */
export function classify(status: number, html: string, refusalConfirmed = true): Verdict {
  if (status === 403 || status === 401 || status === 429) {
    if (!refusalConfirmed) {
      return {
        readable: false,
        reason: "error",
        method: "none",
        detail: `HTTP ${status} from one client only, not reproduced by the second. Inconclusive, not recorded as a block.`,
      };
    }
    return { readable: false, reason: "blocked", method: "none", detail: `HTTP ${status}` };
  }
  if (status >= 400) {
    return { readable: false, reason: "error", method: "none", detail: `HTTP ${status}` };
  }

  // Challenge interstitials return 200 with a body that is not the site.
  if (/just a moment|checking your browser|cf-browser-verification|px-captcha/i.test(html)) {
    return {
      readable: false,
      reason: "blocked",
      method: "none",
      detail: "200 with a challenge interstitial",
    };
  }

  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>/gi)].length;
  const ogTags = [...html.matchAll(/<meta[^>]+property=["']og:/gi)].length;

  if (jsonLd > 0) {
    return {
      readable: true,
      reason: null,
      method: "jsonld",
      detail: `${jsonLd} JSON-LD block${jsonLd === 1 ? "" : "s"}`,
    };
  }
  if (ogTags >= 2) {
    return { readable: true, reason: null, method: "opengraph", detail: `${ogTags} og: tags` };
  }

  // No typed data. Separate "the HTML is a shell" from "the HTML is prose with no markup",
  // because those are different findings with different fixes. Text ratio is a blunt
  // instrument, so the threshold is stated in the detail string rather than hidden.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (html.length > 0 && text.length < 500) {
    return {
      readable: false,
      reason: "js_shell",
      method: "none",
      detail: `${html.length}B of HTML, only ${text.length}B of readable text`,
    };
  }
  return {
    readable: false,
    reason: "no_structured_data",
    method: "none",
    detail: `${Math.round(html.length / 1024)}KB of HTML, no JSON-LD, ${ogTags} og: tag${ogTags === 1 ? "" : "s"}`,
  };
}

/**
 * Normalise arbitrary user input into a hostname we are willing to fetch.
 *
 * This is the front door of a public, unauthenticated endpoint that makes an outbound
 * request on the caller's behalf, which is the classic SSRF shape. Everything that is not
 * a public http(s) host on a normal port is refused, and the refusal is by allowlist
 * (scheme, port) plus explicit denial of private space, rather than by pattern-matching
 * things that look suspicious.
 *
 * Returns the canonical https origin to fetch, or an error string explaining the refusal.
 */
export function normaliseDomainInput(
  raw: string,
): { url: string; host: string } | { error: string } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { error: "Enter a domain." };
  if (trimmed.length > 253) return { error: "That is not a domain." };

  // Any explicit scheme is parsed and judged as written. Only a bare host gets https://
  // prepended. Doing it the other way round (prepend unless it starts with http) meant
  // "file:///etc/passwd" became "https://file:///etc/passwd", which throws and was reported
  // as "that is not a domain" while the scheme check below sat permanently unreachable. The
  // coverage ratchet flagged the dead branch, and the dead branch was the symptom.
  // The negative lookahead separates a scheme from a port. Without it "example.com:8080"
  // reads as the scheme "example.com:" and is refused for the wrong reason, hiding the
  // port rule behind a scheme error.
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/.test(trimmed);

  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return { error: "That is not a domain." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Only http and https are supported." };
  }
  // Credentials in the URL would let a caller aim us at an internal host that only
  // authenticates by userinfo.
  if (parsed.username || parsed.password) return { error: "That is not a domain." };

  // Default ports only. An arbitrary port turns this into a port scanner.
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return { error: "Only the default ports are supported." };
  }

  const host = parsed.hostname;

  // Must look like a real public name.
  if (!host.includes(".") || host.endsWith(".")) return { error: "That is not a domain." };
  if (!/^[a-z0-9.-]+$/.test(host)) return { error: "That is not a domain." };

  // Private and special-use space, denied explicitly. An IP literal is never a customer's
  // marketing site, so all of them are refused rather than only the private ranges.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    return { error: "Enter a domain name, not an IP address." };
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain")
  ) {
    return { error: "That host is not reachable from the public internet." };
  }

  return { url: `https://${host}/`, host };
}
