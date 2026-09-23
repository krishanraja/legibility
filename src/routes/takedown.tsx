import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/takedown")({
  head: () => ({ meta: [{ title: "Takedown · Legibility" }] }),
  component: Takedown,
});

function Takedown() {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-5xl">Takedown request</h1>
        <p className="mt-4 text-muted-foreground">
          File a request to remove cached product data. We respond within 24 hours.
        </p>
        {done ? (
          <div className="mt-8 rounded-md border border-hairline bg-surface p-6">
            <div className="font-display text-2xl">Received.</div>
            <p className="mt-2 text-sm text-muted-foreground">We'll follow up at {email}.</p>
          </div>
        ) : (
          <form
            className="mt-8 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const res = await fetch("/api/takedown", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ email, url, reason }),
                });
                const body = await res.json();
                if (!res.ok) {
                  setError(body.message ?? "That did not work.");
                  return;
                }
                setDone(true);
              } catch {
                setError("That did not work. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input
              required
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface"
            />
            <Input
              required
              placeholder="URL to remove"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-surface"
            />
            <Textarea
              required
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-surface"
              rows={5}
            />
            <Button
              type="submit"
              disabled={busy}
              className="bg-signal text-background hover:opacity-90"
            >
              {busy ? "Filing\u2026" : "File request"}
            </Button>
            {error && <p className="font-mono text-sm text-signal">{error}</p>}
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
