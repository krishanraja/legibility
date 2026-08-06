import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [{ title: "Docs · Legibility" }, { name: "description", content: "Legibility API and MCP server documentation." }] }),
  component: DocsLayout,
});

function DocsLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1280px] grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12 px-6 py-12">
        <aside className="font-mono text-sm space-y-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Get started</div>
            <ul className="space-y-1.5">
              <li><Link to="/docs" activeOptions={{ exact: true }} activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">Overview</Link></li>
              <li><Link to="/docs/quickstart" activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">Quickstart</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">API</div>
            <ul className="space-y-1.5">
              <li><Link to="/docs/api/read-product" activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">read_product</Link></li>
              <li><Link to="/docs/api/resolve-product" activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">resolve_product</Link></li>
              <li><Link to="/docs/webhooks" activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">Webhooks</Link></li>
              <li><Link to="/docs/rate-limits" activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">Rate limits</Link></li>
              <li><Link to="/docs/errors" activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">Errors</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Agents</div>
            <ul className="space-y-1.5">
              <li><Link to="/docs/mcp" activeProps={{ className: "text-signal" }} className="text-muted-foreground hover:text-foreground">MCP + x402</Link></li>
            </ul>
          </div>
        </aside>
        <main className="prose-editorial max-w-3xl"><Outlet /></main>
      </div>
      <SiteFooter />
    </div>
  );
}
