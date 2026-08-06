import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createCheckoutSession, createPortalSession } from "@/lib/api/billing.functions";

type Sub = {
  plan_id: string;
  status: string;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
};
type Plan = {
  id: string;
  name: string;
  price_cents: number;
  included_calls: number;
  features: unknown;
};
type Invoice = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  hosted_url: string | null;
  created_at: string;
};

function BillingPage() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Sub | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("status")
      : null;

  async function load() {
    const [{ data: s }, { data: pl }, { data: inv }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_id,status,cancel_at_period_end,stripe_customer_id")
        .maybeSingle(),
      supabase
        .from("plans")
        .select("id,name,price_cents,included_calls,features")
        .order("sort_order"),
      supabase
        .from("invoices")
        .select("id,amount_cents,currency,status,hosted_url,created_at")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    setSub((s as Sub) ?? null);
    setPlans((pl as Plan[]) ?? []);
    setInvoices((inv as Invoice[]) ?? []);
  }
  useEffect(() => {
    void load();
  }, [user]);

  const currentPlan = sub?.plan_id ?? "free";

  async function upgrade(plan: "starter" | "growth") {
    setBusy(plan);
    setError(null);
    try {
      const { url } = await createCheckoutSession({ data: { plan } });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(null);
    }
  }
  async function manage() {
    setBusy("portal");
    setError(null);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the billing portal.");
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl">Billing</h1>
      <p className="mt-3 text-muted-foreground">
        Current plan: <span className="text-foreground">{currentPlan}</span>
        {sub?.status && sub.status !== "active" ? ` (${sub.status})` : ""}.
      </p>

      {status === "success" && (
        <div className="mt-4 rounded-md border border-hairline bg-surface p-4 text-sm text-foreground">
          Subscription started. It may take a few seconds to reflect here.
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-md border border-signal bg-surface p-4 text-sm text-signal">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plans.map((p) => {
          const features = Array.isArray(p.features) ? (p.features as string[]) : [];
          const isCurrent = p.id === currentPlan;
          return (
            <div
              key={p.id}
              className={`rounded-md border bg-surface p-5 ${isCurrent ? "border-signal" : "border-hairline"}`}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-2xl">{p.name}</div>
                <div className="font-mono text-sm text-muted-foreground">
                  ${(p.price_cents / 100).toFixed(0)}/mo
                </div>
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {p.included_calls.toLocaleString()} calls
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <span className="font-mono text-xs uppercase tracking-widest text-signal">
                    Current plan
                  </span>
                ) : p.id === "free" ? (
                  <span className="font-mono text-xs text-muted-foreground">{"·"}</span>
                ) : (
                  <button
                    onClick={() => upgrade(p.id as "starter" | "growth")}
                    disabled={busy !== null}
                    className="rounded-sm bg-signal px-4 py-2 font-mono text-sm text-background disabled:opacity-50"
                  >
                    {busy === p.id
                      ? "redirecting…"
                      : currentPlan === "free"
                        ? "Subscribe"
                        : "Switch"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sub?.stripe_customer_id && (
        <div className="mt-6">
          <button
            onClick={manage}
            disabled={busy !== null}
            className="rounded-sm border border-hairline px-4 py-2 font-mono text-sm hover:border-signal disabled:opacity-50"
          >
            {busy === "portal" ? "opening…" : "Manage billing"}
          </button>
        </div>
      )}

      <h2 className="mt-12 font-display text-2xl">Invoices</h2>
      <div className="mt-4 space-y-2">
        {invoices.length === 0 ? (
          <div className="font-mono text-xs text-muted-foreground">No invoices yet.</div>
        ) : (
          invoices.map((iv) => (
            <div
              key={iv.id}
              className="flex items-center justify-between rounded-md border border-hairline bg-surface px-4 py-3 font-mono text-xs"
            >
              <span>{new Date(iv.created_at).toLocaleDateString()}</span>
              <span>
                ${(iv.amount_cents / 100).toFixed(2)} {iv.currency.toUpperCase()} · {iv.status}
              </span>
              {iv.hosted_url ? (
                <a
                  href={iv.hosted_url}
                  target="_blank"
                  rel="noopener"
                  className="text-signal underline"
                >
                  view
                </a>
              ) : (
                <span className="text-muted-foreground">{"·"}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  component: BillingPage,
});
