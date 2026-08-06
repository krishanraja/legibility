import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createApiKey, revokeApiKey } from "@/lib/api/keys.functions";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  last_four: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function KeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_keys")
      .select("id,name,prefix,last_four,last_used_at,revoked_at,created_at")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setKeys((data ?? []) as KeyRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const active = keys.filter((k) => !k.revoked_at);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const res = await createApiKey({ data: { name: "default" } });
      setFresh(res.key);
      setCopied(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create key.");
    }
    setBusy(false);
  }

  async function onRevoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await revokeApiKey({ data: { id } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke key.");
    }
    setBusy(false);
  }

  return (
    <div>
      <h1 className="font-display text-4xl text-foreground">API keys</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Your secret key (<span className="font-mono">lgk_…</span>) authenticates calls to read_product.
        It is shown once at creation. Store it safely.
      </p>

      {fresh && (
        <div className="mt-6 rounded-md border border-signal bg-surface p-5">
          <div className="font-mono text-xs uppercase tracking-widest text-signal">New key, shown once</div>
          <div className="mt-3 flex items-center gap-3">
            <code className="flex-1 break-all rounded-sm border border-hairline bg-background px-3 py-2 font-mono text-sm">
              {fresh}
            </code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(fresh);
                setCopied(true);
              }}
              className="shrink-0 rounded-sm border border-hairline px-3 py-2 font-mono text-xs hover:border-signal"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Save this now. You will not see it again. If you lose it, revoke and create a new one.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-md border border-signal bg-surface p-4 text-sm text-signal">{error}</div>
      )}

      <div className="mt-8">
        <button
          onClick={onCreate}
          disabled={busy || active.length >= 1}
          className="rounded-sm bg-signal px-4 py-2 font-mono text-sm text-background disabled:opacity-50"
        >
          {busy ? "working…" : active.length >= 1 ? "Active key exists (revoke to replace)" : "Create API key"}
        </button>
      </div>

      <div className="mt-8 space-y-3">
        {loading ? (
          <div className="font-mono text-xs text-muted-foreground">loading…</div>
        ) : keys.length === 0 ? (
          <div className="rounded-md border border-dashed border-hairline bg-surface p-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No keys yet. Create one to start.
          </div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-md border border-hairline bg-surface px-5 py-4"
            >
              <div>
                <div className="font-mono text-sm text-foreground">
                  {k.prefix}…{k.last_four}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {k.name} · created {new Date(k.created_at).toLocaleDateString()} ·{" "}
                  {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString()}` : "never used"}
                  {k.revoked_at ? " · revoked" : ""}
                </div>
              </div>
              {!k.revoked_at && (
                <button
                  onClick={() => onRevoke(k.id)}
                  disabled={busy}
                  className="shrink-0 rounded-sm border border-hairline px-3 py-1.5 font-mono text-xs text-muted-foreground hover:border-signal hover:text-foreground disabled:opacity-50"
                >
                  revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/keys")({ component: KeysPage });
