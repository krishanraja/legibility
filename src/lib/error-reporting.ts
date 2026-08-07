// Client error reporting.
//
// This was a console.error stub with a TODO for eighteen months of commits, which means an
// unattended pipeline had no monitoring at all: the way you found out about a failure was a
// customer telling you.
//
// It now forwards to PostHog, which is already loaded on every page from __root.tsx and
// already carries the `product: legibility` super-property. That is deliberate. The brief
// says not to add a fifth piece of infrastructure, and a second vendor here would mean
// another key to rotate, another bill and another dashboard to not look at, to capture
// events that the analytics tool already accepts.
//
// The forward is defensive on purpose. PostHog loads asynchronously via an injected script,
// so window.posthog is genuinely absent for the first moments of a page's life, and that is
// exactly when a boot error would fire. An error reporter that throws while reporting an
// error is worse than no reporter, so every path here falls back to the console rather than
// propagating.

type ErrorContext = Record<string, unknown>;

type PostHogLike = {
  captureException?: (error: unknown, properties?: Record<string, unknown>) => void;
  capture?: (event: string, properties?: Record<string, unknown>) => void;
};

function posthog(): PostHogLike | undefined {
  return (globalThis as { posthog?: PostHogLike }).posthog;
}

export function reportError(error: unknown, context: ErrorContext = {}) {
  if (typeof window === "undefined") return;

  const enriched: Record<string, unknown> = {
    route: window.location.pathname,
    ...context,
  };

  // Always log. The console line is what a developer reads while working, and it is the
  // only record if the analytics script was blocked by an extension or a content policy.
  console.error("[legibility] client error", enriched, error);

  try {
    const ph = posthog();
    if (!ph) return;

    if (typeof ph.captureException === "function") {
      ph.captureException(error, enriched);
      return;
    }
    // Older loaders expose only capture(). Send the same information as a named event so
    // the data still lands rather than being silently dropped on the version difference.
    if (typeof ph.capture === "function") {
      ph.capture("$exception", {
        ...enriched,
        $exception_message: error instanceof Error ? error.message : String(error),
        $exception_type: error instanceof Error ? error.name : typeof error,
        $exception_stack_trace_raw: error instanceof Error ? error.stack : undefined,
      });
    }
  } catch (reportingFailure) {
    // Never let the reporter become the incident.
    console.error("[legibility] error reporting failed", reportingFailure);
  }
}

/**
 * Deliberately throws, so the monitoring path can be proven rather than assumed.
 *
 * The brief asks for the wiring to be proved by throwing something on purpose. Exposed on
 * window in the browser so it can be triggered from a console on any environment without
 * shipping a route that a crawler could find and fire.
 */
export function throwTestError(note = "deliberate test exception") {
  const e = new Error(`[legibility] ${note}`);
  reportError(e, { deliberate: true, note });
  return e;
}

if (typeof window !== "undefined") {
  (
    globalThis as { __legibilityThrowTestError?: typeof throwTestError }
  ).__legibilityThrowTestError = throwTestError;
}
