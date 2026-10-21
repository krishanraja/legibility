import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/seo";

// P3.7: webhooks are not built. The old page documented 5 events, HMAC signing, and a
// retry schedule for an async resolve API that does not exist. Honest roadmap page.
export const Route = createFileRoute("/docs/webhooks")({
  head: () => ({
    meta: pageMeta({
      title: "Webhooks · Legibility docs",
      description:
        "Webhooks are on the roadmap and not shipped. Every Legibility call is synchronous and returns its result in the response.",
      path: "/docs/webhooks",
    }),
  }),
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">Webhooks</h1>
      <p className="text-lg text-muted-foreground">
        Webhooks are on the roadmap, not shipped. Today every Legibility call is synchronous: you
        send a request and get the typed product object back in the response, with its confidence
        and per-call cost stamped in.
      </p>
      <p className="text-muted-foreground">
        The planned use case is product-change events (price moved, back in stock) for products you
        have read, delivered as signed HTTP POSTs. If that would unblock something you are building,
        tell us at <span className="font-mono">founders@legibility.io</span> and we will prioritise
        it.
      </p>
    </article>
  ),
});
