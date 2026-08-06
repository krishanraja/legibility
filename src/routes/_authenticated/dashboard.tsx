import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 font-mono text-xs">
          <Link to="/" className="flex items-center gap-2">
            <span className="dot" />
            <span className="font-display text-xl">legibility</span>
            <span className="ml-2 text-muted-foreground">/ dashboard</span>
          </Link>
          <div className="flex items-center gap-5 text-muted-foreground">
            <span className="hidden sm:inline">{user?.email}</span>
            <button
              onClick={async () => { await signOut(); router.navigate({ to: "/" }); }}
              className="rounded-sm border border-hairline px-3 py-1.5 text-foreground hover:border-signal"
            >
              sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1280px] grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 px-6 py-10">
        <nav className="font-mono text-sm space-y-1">
          {[
            { to: "/dashboard", label: "Overview", exact: true },
            { to: "/dashboard/keys", label: "API keys" },
            { to: "/dashboard/usage", label: "Usage" },
            { to: "/dashboard/billing", label: "Billing" },
            { to: "/dashboard/webhooks", label: "Webhooks" },
            { to: "/dashboard/metrics", label: "Metrics" },
          ].map((i) => (
            <Link
              key={i.to}
              to={i.to}
              activeOptions={{ exact: i.exact }}
              activeProps={{ className: "block rounded-sm bg-surface px-3 py-2 text-signal" }}
              inactiveProps={{ className: "block rounded-sm px-3 py-2 text-muted-foreground hover:text-foreground" }}
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
