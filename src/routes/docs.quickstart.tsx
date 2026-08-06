import { createFileRoute } from "@tanstack/react-router";
import { demoCurl } from "@/config/product";
export const Route = createFileRoute("/docs/quickstart")({
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">Quickstart</h1>
      <p className="text-lg text-muted-foreground">Create a key in the dashboard, then call the API.</p>
      <pre className="rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto">
{demoCurl("lgk_…")}
      </pre>
      <p className="text-muted-foreground">Response is a typed product object with a confidence score and the per-call cost. The sample GTIN is a real barcode that returns a real trusted object; URL reads are in private beta.</p>
    </article>
  ),
});
