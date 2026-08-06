import { createFileRoute, Link } from "@tanstack/react-router";
import { demoCurl } from "@/config/product";

function Overview() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Welcome to Legibility</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          One call turns a URL or a barcode into a typed product object with per-field confidence, a
          price band, and the per-call cost stamped in the response.
        </p>
      </div>
      <div className="rounded-md border border-hairline bg-surface p-6">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Get started
        </div>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Create your secret key on the{" "}
            <Link to="/dashboard/keys" className="text-signal underline">
              API keys
            </Link>{" "}
            page.
          </li>
          <li>Call read_product with it:</li>
        </ol>
        <pre className="mt-3 overflow-x-auto whitespace-pre rounded-sm border border-hairline bg-background p-4 font-mono text-xs">
          {demoCurl()}
        </pre>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          The sample GTIN is real and returns a real object you can inspect. Swap in your key and
          run it as-is.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Full reference in the{" "}
          <a href="/docs" className="text-signal underline">
            docs
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: Overview });
