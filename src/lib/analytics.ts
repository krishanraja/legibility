// Product events, forwarded to PostHog.
//
// Before this, the only events the product emitted were $pageview, $pageleave and
// $exception. That meant the acquisition path was dark: you could see traffic arriving at
// the front page and a row count in the waitlist table, and nothing in between. In
// particular you could not answer the question the front page's whole design rests on,
// which is whether an unreadable verdict converts better than a readable one. That claim is
// written into the DomainChecker comment as the conversion mechanism, and until now it was
// an assertion rather than a measurement.
//
// Same reasoning as error-reporting.ts for using PostHog rather than a second vendor: it is
// already loaded on every page from __root.tsx and already carries the `product: legibility`
// super-property. The forward is defensive for the same reason too. The script loads
// asynchronously, an extension or a content policy may block it entirely, and analytics that
// throws while recording a funnel step would break the funnel it exists to measure.

type PostHogLike = {
  capture?: (event: string, properties?: Record<string, unknown>) => void;
  identify?: (id: string, properties?: Record<string, unknown>) => void;
};

function posthog(): PostHogLike | undefined {
  return (globalThis as { posthog?: PostHogLike }).posthog;
}

/**
 * The events this product emits, named once.
 *
 * A closed list rather than free-form strings, for the same reason FailureReason is a closed
 * list: a typo in an event name does not fail, it silently produces a second funnel that
 * nobody notices is missing half the data.
 */
export type ProductEvent =
  | "check_submitted"
  | "check_returned"
  | "check_failed"
  | "capture_submitted"
  | "capture_succeeded"
  | "pricing_plan_clicked"
  | "signin_opened";

export function capture(event: ProductEvent, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    posthog()?.capture?.(event, properties);
  } catch {
    // Never let measurement become the incident. A dropped event is a gap in a chart; a
    // throw here is a visitor who cannot finish the thing being measured.
  }
}

/**
 * Attach the person to everything they did before they gave a name.
 *
 * Called on a successful capture, which is the first point at which an anonymous visitor
 * becomes identifiable. PostHog is configured with person_profiles: 'identified_only', so
 * without this call the check that produced the conversion and the conversion itself stay in
 * separate, unjoinable halves.
 */
export function identify(email: string, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    posthog()?.identify?.(email, { email, ...properties });
  } catch {
    /* as above */
  }
}
