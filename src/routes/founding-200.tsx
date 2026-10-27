import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  EmailStep,
  Intro,
  ReportCard,
  RunForm,
  Sent,
  Welcome,
  type RunFormValues,
} from "@/components/founding/FoundingViews";
import { supabase } from "@/integrations/supabase/client";
import { trackGrowth } from "@/lib/analytics";
import { channelLabel } from "@/lib/api/attribution";
import { parseFoundingInput, verificationOptions, type FoundingReport } from "@/lib/api/founding";
import {
  claimFoundingEntry,
  getFoundingSetup,
  recordFoundingView,
  runFoundingTest,
  submitFoundingEntry,
  type FoundingWelcome,
} from "@/lib/api/founding.functions";
import { currentTouch } from "@/lib/attribution-client";
import { useAuth } from "@/lib/auth";
import { pageMeta } from "@/lib/seo";

/**
 * A3: the run-first Founding 200 page. Run the test with no account; see the result inline;
 * then, and only then, an email for a sign-in link; after it, the key and the report.
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};

/** Cloudflare Turnstile, the bot challenge. No site key means the test is paused. */
function Challenge({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (t: string) => void;
  resetKey: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  useEffect(() => {
    const w = window as unknown as { turnstile?: TurnstileApi };
    const mount = () => {
      if (!box.current || !w.turnstile || widget.current) return;
      widget.current = w.turnstile.render(box.current, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    if (w.turnstile) mount();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
  }, [siteKey, onToken]);
  useEffect(() => {
    const w = window as unknown as { turnstile?: TurnstileApi };
    if (resetKey > 0 && widget.current) {
      w.turnstile?.reset(widget.current);
      onToken("");
    }
  }, [resetKey, onToken]);
  return <div ref={box} />;
}

function FoundingPage() {
  const { entry } = Route.useSearch();
  const { user, loading } = useAuth();
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined);
  const [values, setValues] = useState<RunFormValues>({
    input: "",
    use_case: "",
    interface: "rest",
    stores: "",
  });
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [run, setRun] = useState<{
    entryId: string;
    trusted: boolean;
    report: FoundingReport;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [welcome, setWelcome] = useState<FoundingWelcome | null>(null);

  useEffect(() => {
    getFoundingSetup()
      .then((s) => setSiteKey(s.siteKey))
      .catch(() => setSiteKey(null));
    recordFoundingView().catch(() => undefined);
  }, []);

  // After the sign-in link: link the entry, take the key and the report, once.
  useEffect(() => {
    if (!entry || loading || !user || welcome) return;
    claimFoundingEntry({ data: { entryId: entry } })
      .then(setWelcome)
      .catch(() => setWelcome({ ok: false, message: "That did not work. Reload to try again." }));
  }, [entry, loading, user, welcome]);

  async function submitRun(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await runFoundingTest({ data: { ...values, token } });
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      setRun({ entryId: r.entryId, trusted: r.trusted, report: r.report });
      const touch = currentTouch();
      trackGrowth("test_run", touch?.invitation_id, channelLabel(touch));
    } catch {
      setMessage("That did not work. Try again.");
    } finally {
      setBusy(false);
      setResetKey((k) => k + 1);
    }
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (!run) return;
    setBusy(true);
    try {
      const touch = currentTouch();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: verificationOptions(window.location.origin, run.entryId, touch),
      });
      if (error) {
        setMessage("The link could not be sent. Check the address and try again.");
        return;
      }
      await submitFoundingEntry({ data: { entryId: run.entryId } }).catch(() => undefined);
      trackGrowth("generate_lead", touch?.invitation_id, channelLabel(touch));
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  const input = welcome?.ok ? parseFoundingInput(welcome.input.value) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl space-y-10 px-6 py-16">
        <Intro />
        {entry && welcome?.ok && input ? (
          <Welcome
            apiKey={welcome.key}
            keyHint={welcome.keyHint}
            input={input}
            report={welcome.report}
            trusted={welcome.trusted}
            contact={welcome.contact}
          />
        ) : entry && welcome && !welcome.ok ? (
          <p className="font-mono text-sm text-signal">{welcome.message}</p>
        ) : entry && !user && !loading ? (
          <p className="text-sm text-muted-foreground">
            Open the sign-in link from your email to see your key and report.
          </p>
        ) : run ? (
          <div className="space-y-6">
            <ReportCard report={run.report} trusted={run.trusted} />
            {sent ? (
              <Sent />
            ) : (
              <EmailStep email={email} onEmail={setEmail} onSubmit={submitEmail} busy={busy} />
            )}
            {message && <p className="font-mono text-sm text-signal">{message}</p>}
          </div>
        ) : (
          <RunForm
            values={values}
            onChange={setValues}
            onSubmit={submitRun}
            busy={busy}
            disabled={!siteKey}
            message={
              siteKey === null
                ? "The test is paused right now. Nothing has been charged to anyone."
                : message
            }
            challenge={
              siteKey ? (
                <Challenge siteKey={siteKey} onToken={setToken} resetKey={resetKey} />
              ) : null
            }
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/founding-200")({
  validateSearch: (search: Record<string, unknown>): { entry?: string } =>
    typeof search.entry === "string" && /^[0-9a-f-]{36}$/.test(search.entry)
      ? { entry: search.entry }
      : {},
  head: () => ({
    meta: pageMeta({
      title: "The Founding 200 · Legibility",
      description:
        "Try Legibility on one of your own products in about two minutes, with no account. Founding 200 members get a 30-day free trial in exchange for feedback.",
      path: "/founding-200",
    }),
  }),
  component: FoundingPage,
});
