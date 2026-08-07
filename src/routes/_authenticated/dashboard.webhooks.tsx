import { createFileRoute } from "@tanstack/react-router";

// P3.4: the old tab leaked an internal build note ("ships with your approval") and
// referenced resolution.done events for an async resolve API that does not exist.
// Until webhook delivery is built, this tab tells the honest truth and points at the
// working surface, with a next action, rather than a dead end.
export const Route = createFileRoute("/_authenticated/dashboard/webhooks")({
  component: () => (
    <div>
      <h1 className="font-display text-4xl">Webhooks</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Webhooks are not available yet. Today Legibility is request and response: call an endpoint,
        get a typed product object back synchronously with its confidence and cost stamped in.
      </p>
      <div className="mt-8 rounded-md border border-hairline bg-surface p-6">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          On the roadmap
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Delivery of product-change events (price moved, back in stock) for products you have read.
          Want it? Tell us what you would build with it and we will prioritise.
        </p>
        <a
          href="mailto:founders@legibility.io?subject=Webhooks"
          className="mt-4 inline-flex rounded-sm border border-hairline px-3 py-1.5 font-mono text-xs text-foreground hover:border-signal hover:text-signal"
        >
          Request webhooks
        </a>
      </div>
    </div>
  ),
});
