// A2: attribution capture. The rules for reading a touch, kept in one place.
//
// A touch is where a builder came from: the invitation id the growth engine put in a link,
// the utm_* tags, the referring site's host (never its path or query), and the MCP directory
// if the link came from one. It lives in a first-party cookie for 30 days, becomes the
// account's enrolment touch when the account is created, and the key's touch when a key is
// created. The database validates every field again (supabase/migrations/20261027130000),
// because a cookie and sign-up metadata are both just input.
//
// Never in a touch: an email address, an IP address, a name, a product input or a key.

/** The cookie that carries the latest touch. First-party, readable by the page. */
export const TOUCH_COOKIE = "lg_touch";
export const TOUCH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** The directories the growth engine lists Legibility in. */
export const DIRECTORIES = [
  "mcp_registry",
  "claude_directory",
  "smithery",
  "glama",
  "pulsemcp",
] as const;
export type Directory = (typeof DIRECTORIES)[number];

/**
 * One referrer host per directory, matched exactly or as a parent domain. A link from a
 * directory listing that carries our own tags (utm_medium=directory&utm_source=<directory>)
 * is recognised without this list.
 *
 * claude.ai is ambiguous: a link clicked inside a Claude conversation also arrives from it.
 * The directory listing's own link carries utm tags, which win over the referrer.
 */
export const DIRECTORY_HOSTS: Record<Directory, string> = {
  mcp_registry: "registry.modelcontextprotocol.io",
  claude_directory: "claude.ai",
  smithery: "smithery.ai",
  glama: "glama.ai",
  pulsemcp: "pulsemcp.com",
};

/** Hosts that are us: a referrer from these is internal navigation, not a touch. */
const OWN_HOSTS = ["legibility.io"];

export const INVITATION_ID = /^legibility:[A-Za-z0-9:._-]+$/;
export const INVITATION_ID_MAX = 120;
export const UTM_VALUE = /^[a-z0-9][a-z0-9._:-]{0,99}$/;
export const CHANNEL_LABEL = /^[a-z0-9][a-z0-9._:-]{0,79}$/;
const HOST = /^[a-z0-9.-]{1,253}$/;
// An IPv4 address anywhere in a value. Never stored or sent, even as a referrer's host.
const IPV4 = /(^|[^0-9])[0-9]{1,3}(\.[0-9]{1,3}){3}($|[^0-9])/;
const CHANNEL_SHAPE =
  /^(direct|internal|introduction|invitation|unattributed|directory:[a-z_]+|utm:.+|referrer:.+)$/;
const PRODUCT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const MCP_CLIENT = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,99}$/;

export type Touch = {
  invitation_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_host: string | null;
  directory: Directory | null;
  touched_at: string;
};

/** An invitation id as the engine writes it, or null. */
export function invitationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length <= INVITATION_ID_MAX && INVITATION_ID.test(value) ? value : null;
}

/** A utm value, lowercased, or null when it is too long or carries anything else. */
export function utmValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return UTM_VALUE.test(v) && !IPV4.test(v) ? v : null;
}

function isDirectory(value: unknown): value is Directory {
  return typeof value === "string" && (DIRECTORIES as readonly string[]).includes(value);
}

function matchesHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** The referrer's host only, lowercased. Never its path or query. */
export function referrerHost(referrer: unknown): string | null {
  if (typeof referrer !== "string" || referrer === "") return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!HOST.test(host) || IPV4.test(host) || OWN_HOSTS.some((own) => matchesHost(host, own))) {
    return null;
  }
  return host;
}

export function directoryForHost(host: string | null): Directory | null {
  if (!host) return null;
  return DIRECTORIES.find((d) => matchesHost(host, DIRECTORY_HOSTS[d])) ?? null;
}

/**
 * The touch a page load carries, or null.
 *
 * A touch exists when the URL has any utm_* parameter or the referrer is a recognised
 * directory. A utm_content that is not an invitation id is dropped; a page load whose
 * fields all come out empty stores nothing.
 */
export function landingTouch(input: {
  search: string;
  referrer: string | null | undefined;
  now: Date;
}): Touch | null {
  const params = new URLSearchParams(input.search);
  const hasUtm = [...params.keys()].some((k) => k.toLowerCase().startsWith("utm_"));
  const host = referrerHost(input.referrer);
  const utm_source = utmValue(params.get("utm_source"));
  const utm_medium = utmValue(params.get("utm_medium"));
  const directory: Directory | null =
    utm_medium === "directory" && isDirectory(utm_source) ? utm_source : directoryForHost(host);
  if (!hasUtm && !directory) return null;

  const touch: Touch = {
    invitation_id: invitationId(params.get("utm_content")),
    utm_source,
    utm_medium,
    utm_campaign: utmValue(params.get("utm_campaign")),
    referrer_host: host,
    directory,
    touched_at: input.now.toISOString(),
  };
  const empty =
    !touch.invitation_id &&
    !touch.utm_source &&
    !touch.utm_medium &&
    !touch.utm_campaign &&
    !touch.referrer_host &&
    !touch.directory;
  return empty ? null : touch;
}

/**
 * The channel label for a touch, by the brief's order. "internal" is decided by the A1 list,
 * never from a touch, so it is not here; no touch at all is "direct".
 */
export function channelLabel(touch: Touch | null): string {
  if (!touch) return "direct";
  let label: string;
  if (touch.invitation_id && touch.utm_medium === "introduction") label = "introduction";
  else if (touch.invitation_id) label = "invitation";
  else if (touch.directory) label = `directory:${touch.directory}`;
  else if (touch.utm_source) label = `utm:${touch.utm_source}`;
  else if (touch.referrer_host) label = `referrer:${touch.referrer_host}`;
  else label = "direct";
  return label.slice(0, 80);
}

/** The cookie value for a touch. */
export function serializeTouch(touch: Touch): string {
  return encodeURIComponent(JSON.stringify(touch));
}

/**
 * The touch in a Cookie header (or document.cookie), re-validated field by field, or null.
 * A cookie is input: anything that does not pass is dropped, and a touch dated in the
 * future or older than 30 days is no touch at all.
 */
export function touchFromCookie(cookieHeader: string | null | undefined, now: Date): Touch | null {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TOUCH_COOKIE}=`));
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(decodeURIComponent(raw.slice(TOUCH_COOKIE.length + 1)));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const at = typeof parsed.touched_at === "string" ? Date.parse(parsed.touched_at) : NaN;
  if (
    Number.isNaN(at) ||
    at > now.getTime() + 60_000 ||
    at < now.getTime() - TOUCH_MAX_AGE_SECONDS * 1000
  ) {
    return null;
  }
  const host = typeof parsed.referrer_host === "string" ? parsed.referrer_host : null;
  const touch: Touch = {
    invitation_id: invitationId(parsed.invitation_id),
    utm_source: utmValue(parsed.utm_source),
    utm_medium: utmValue(parsed.utm_medium),
    utm_campaign: utmValue(parsed.utm_campaign),
    referrer_host: host && HOST.test(host) && !IPV4.test(host) ? host : null,
    directory: isDirectory(parsed.directory) ? parsed.directory : null,
    touched_at: new Date(at).toISOString(),
  };
  return channelLabel(touch) === "direct" ? null : touch;
}

/** The Set-Cookie / document.cookie string that stores a touch for 30 days. */
export function touchCookie(touch: Touch, secure: boolean): string {
  return [
    `${TOUCH_COOKIE}=${serializeTouch(touch)}`,
    "Path=/",
    `Max-Age=${TOUCH_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/** The first product token of a User-Agent, without its version: "curl/8.4.0 x" is "curl". */
export function firstProductToken(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const token = userAgent.trim().split(/[\s/]/)[0];
  return PRODUCT_TOKEN.test(token) ? token : null;
}

/** An MCP initialize request's clientInfo.name, or null when it is not a plain name. */
export function mcpClientName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const v = name.trim();
  return MCP_CLIENT.test(v) ? v : null;
}

/** The three growth events, sent to GA4 and PostHog under the same names. */
export type GrowthEvent = "generate_lead" | "sign_up" | "test_run";

/**
 * The only parameters a growth event carries: the invitation id and the channel label.
 * Never an email, an IP, a product input or a key.
 */
export function growthEventParams(
  invitation: string | null | undefined,
  channel: string | null | undefined,
): { invitation_id?: string; channel: string } {
  const inv = invitationId(invitation);
  const label =
    typeof channel === "string" &&
    CHANNEL_LABEL.test(channel) &&
    CHANNEL_SHAPE.test(channel) &&
    !IPV4.test(channel)
      ? channel
      : "direct";
  return inv ? { invitation_id: inv, channel: label } : { channel: label };
}
