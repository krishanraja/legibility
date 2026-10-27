// A2: the browser's half of attribution capture. The rules live in src/lib/api/attribution.ts;
// this file only reads the page's URL and referrer and writes the first-party cookie.
import { trackGrowth } from "@/lib/analytics";
import { landingTouch, touchCookie, touchFromCookie, type Touch } from "@/lib/api/attribution";

/**
 * Called once when a page first loads. A load with utm_* tags or from a recognised MCP
 * directory replaces the stored touch (the latest touch wins); any other load leaves it as it
 * is. Never throws: a blocked cookie is a lost touch, not a broken page.
 */
export function recordLanding(): void {
  if (typeof window === "undefined") return;
  try {
    const touch = landingTouch({
      search: window.location.search,
      referrer: document.referrer,
      now: new Date(),
    });
    if (touch) document.cookie = touchCookie(touch, window.location.protocol === "https:");
  } catch {
    /* attribution best-effort */
  }
}

/** The stored touch, validated again, or null. */
export function currentTouch(): Touch | null {
  if (typeof document === "undefined") return null;
  try {
    return touchFromCookie(document.cookie, new Date());
  } catch {
    return null;
  }
}

/**
 * After a sign-in: ask the server whether this is the account's first verified session, and
 * send sign_up only when it is. The server answers yes once per account, so a second tab, a
 * second browser or a later sign-in never sends it again.
 */
export async function reportSignUp(): Promise<void> {
  try {
    const { claimSignUp } = await import("@/lib/api/attribution.functions");
    const r = await claimSignUp();
    if (r.first) trackGrowth("sign_up", r.invitation_id, r.channel);
  } catch {
    /* attribution best-effort */
  }
}
