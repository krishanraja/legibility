// Vendor-neutral client error reporting.
// Sentry-ready: initialize @sentry/react in initErrorReporting() and forward in reportError().
// No-op (console only) until a provider is configured, so the app never hard-depends on a vendor.

type ErrorContext = Record<string, unknown>;

export function reportError(error: unknown, context: ErrorContext = {}) {
  if (typeof window === "undefined") return;
  const enriched = { route: window.location.pathname, ...context };
  // TODO(observability): Sentry.captureException(error, { extra: enriched })
  console.error("[legibility] client error", enriched, error);
}
