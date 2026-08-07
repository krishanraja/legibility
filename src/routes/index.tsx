import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { API_BASE, DEMO_GTIN } from "@/config/product";
import { REASON_COPY, type FailureReason } from "@/lib/api/readability";
import calibration from "@/data/calibration.json";

/**
 * The front page argues one position: a lot of the web cannot be read by a machine, and
 * that is measurable. It is written for a commercial buyer, not a developer. Developers are
 * served in /docs and deliberately do not shape this page.
 *
 * The primary action is a verdict about the reader's own domain, not a signup and not a
 * demo. That is the whole conversion mechanism: it produces a finding, the finding produces
 * the reaction, and because the tool is the product demonstrating itself, the page cannot
 * overclaim without being caught within seconds.
 *
 * Every number here is either traceable to a stored row or labelled with its sample size.
 * The calibration figures come from src/data/calibration.json, generated from the
 * golden_eval_runs table, so the page cannot drift from what was actually measured.
 */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Legibility · Can a machine read your website?" },
      {
        name: "description",
        content:
          "Enter a domain and see what an AI crawler sees. Legibility measures whether a machine can read a website, and records why when it cannot. Method and sample sizes published with every figure.",
      },
      { property: "og:title", content: "Legibility · Can a machine read your website?" },
      {
        property: "og:description",
        content:
          "AI assistants recommend products without asking the brand. Enter your domain and see whether one can read yours.",
      },
    ],
    // FAQPage structured data. Mirrors the on-page FAQ below question for question: answer
    // engines quote this verbatim, so a version that drifts from the page is a version that
    // gets quoted wrongly. An earlier revision claimed an unblocker as a live data source
    // while it was switched off, which is exactly the failure this mirroring prevents.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }),
      },
    ],
  }),
  component: Index,
});

/**
 * The FAQ, defined once and rendered twice: as the visible list and as the JSON-LD above.
 * A previous version kept two hand-maintained copies that had drifted to six questions
 * versus seven, with two answers differing in substance, under a comment claiming they
 * matched.
 */
const FAQ: [string, string][] = [
  [
    "What exactly do you measure?",
    "We request your homepage once, with an identified user agent, exactly as an answer engine's crawler would. We do not run a headless browser and we do not use a proxy to get around a refusal. Then we classify what came back: structured data present, content assembled by JavaScript, no structured data at all, or a refusal.",
  ],
  [
    "Why does that matter commercially?",
    "AI assistants increasingly answer product questions directly. When they cannot read your site, they answer from somewhere else: a marketplace listing, a review aggregator, a competitor. You do not get a bounce or a lost session to look at, because the visit never happened.",
  ],
  [
    "Is a low score always the site's fault?",
    "No, and we say so in the result. Rendering in JavaScript is usually an accident of how the site was built rather than a decision. Refusing crawlers is a deliberate choice and often a reasonable one. Those are different findings and we report them differently.",
  ],
  [
    "How confident are you in the confidence score?",
    `Measured on a held-out test split of ${calibration.n} items: precision at the 0.7 trust gate is ${calibration.precision_at_gate}, with a Wilson lower bound of ${calibration.precision_wilson_low}. The honest limit is that expected calibration error across the full range is ${calibration.ece}, so the score is dependable at the gate and looser in the middle. One evaluation is a claim rather than a credential, which is why the run and its sample size are published rather than the headline alone.`,
  ],
  [
    "Do you respect robots.txt?",
    "Yes, and a site that disallows us is recorded as a data point rather than worked around. Being unreadable because you asked to be is a finding, not an obstacle. The credibility of a referee can only be destroyed once.",
  ],
  [
    "Can a site ask to be removed?",
    "Yes. File a takedown at https://legibility.io/takedown and we honour it within 24 hours.",
  ],
  [
    "Is there an API?",
    "Yes. The same engine is available as a REST API and as an MCP server, priced per call. It is the instrument behind the index rather than the headline, and it is documented at https://legibility.io/docs.",
  ],
];

type CheckResult = {
  host: string;
  readable: boolean;
  reason: FailureReason | null;
  method: string;
  detail: string;
  http_status?: number;
  checked_at: string;
};

function DomainChecker() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.message ?? "That did not work.");
      else setResult(body as CheckResult);
    } catch {
      setError("That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="yourbrand.com"
          aria-label="Your domain"
          className="bg-surface font-mono"
        />
        <Button
          type="submit"
          disabled={busy}
          className="shrink-0 bg-signal text-background hover:opacity-90"
        >
          {busy ? "Reading…" : "See what a machine sees"}
        </Button>
      </form>

      {error && <p className="mt-4 font-mono text-sm text-signal">{error}</p>}

      {result && (
        <div className="mt-6 rounded-md border border-hairline bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span>{result.host}</span>
            <span>
              {new Date(result.checked_at).toISOString().slice(0, 16).replace("T", " ")} UTC
            </span>
          </div>

          <p className="font-display mt-3 text-3xl text-foreground">
            {result.readable ? "A machine can read this site." : "A machine cannot read this site."}
          </p>

          <p className="mt-3 text-muted-foreground">
            {result.readable
              ? `Structured data was found and parsed. Method: ${result.method}. This is the good outcome, and we would rather say so than invent a problem.`
              : (result.reason && REASON_COPY[result.reason]) || "The result was inconclusive."}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-4 font-mono text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">verdict</dt>
              <dd className="mt-1 text-foreground">
                {result.readable ? "readable" : (result.reason ?? "unknown")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">method</dt>
              <dd className="mt-1 text-foreground">{result.method}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">evidence</dt>
              <dd className="mt-1 text-foreground">{result.detail}</dd>
            </div>
          </dl>

          <p className="mt-5 border-t border-hairline pt-4 text-sm text-muted-foreground">
            This is one page, read once, today. The field-by-field breakdown, the history over time,
            and how you compare with the rest of your category need an account.
          </p>
          <div className="mt-4">
            <CaptureEmail host={result.host} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Email capture placed after the result, not before it. The exchange is for something the
 * person now wants (depth, history, comparison) rather than a toll gate on the verdict
 * they came for.
 */
function CaptureEmail({ host }: { host: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("waitlist")
      .insert({ email, company: host, use_case: "domain check", source: "checker" });
    setBusy(false);
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    setDone(true);
  }

  if (done) return <p className="font-mono text-sm text-foreground">Noted. We will be in touch.</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        aria-label="Your email"
        className="bg-background"
      />
      <Button type="submit" disabled={busy} variant="outline" className="shrink-0">
        {busy ? "…" : "Send me the full read"}
      </Button>
    </form>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        {/* THE FINDING, AND THE READER'S OWN VERSION OF IT */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-20 lg:py-28">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              Machine readability index
            </p>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] text-balance text-foreground sm:text-6xl">
              Most of the web was built for people.
              <span className="mt-3 block italic text-stone">
                Increasingly, the reader is not one.
              </span>
            </h1>
            <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
              When an assistant answers a question about a product, it reads the page first. If it
              cannot read yours, it answers from a marketplace listing, a review site, or a
              competitor. Nothing shows up in your analytics, because the visit never happened.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-foreground">
              You can check this yourself, right now, without talking to anyone.
            </p>

            <div className="mt-10">
              <DomainChecker />
            </div>

            <p className="mt-4 font-mono text-xs text-muted-foreground">
              One request to your homepage, identified as LegibilityBot, exactly as a crawler would.
              We obey robots.txt. Nothing is stored against your domain unless you ask us to.
            </p>
          </div>
        </section>

        {/* HOW IT WAS MEASURED, INCLUDING THE LIMITS */}
        <section id="method" className="border-b border-hairline bg-surface/40">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-24 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §01 · method
              </p>
              <h2 className="font-display mt-3 text-4xl text-balance text-foreground">
                How the reading is judged.
              </h2>
            </div>
            <div className="space-y-6 text-muted-foreground">
              <p>
                A page is readable when a machine can extract typed facts from it without guessing.
                In practice that means structured data: JSON-LD, or failing that OpenGraph.
                Everything else is prose that a model has to interpret, and interpretation is where
                it invents things.
              </p>
              <p>
                When a page is not readable, the reason matters more than the verdict. A site that
                refuses crawlers made a decision. A site that renders only in JavaScript did not. A
                site with clean HTML and no markup is one afternoon away from being fixed. We record
                those separately because they are different problems with different costs.
              </p>

              <div className="rounded-md border border-hairline bg-background p-6">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  the confidence score, and its limit
                </div>
                <p className="mt-3 text-foreground">
                  Every extraction carries a calibrated confidence, and a 0.7 gate decides whether
                  it is safe to rely on. On a held-out test split of {calibration.n} items,
                  precision at that gate is {calibration.precision_at_gate}, with a Wilson lower
                  bound of {calibration.precision_wilson_low}.
                </p>
                <p className="mt-3">
                  The limit, stated on the same screen as the claim: expected calibration error
                  across the full range is {calibration.ece}. The score is dependable at the gate
                  and looser in the middle. One evaluation run is a claim, not a credential, so the
                  run is identified ({calibration.calibration_version}) and its sample size travels
                  with the number.
                </p>
              </div>

              <p>
                We do not run a headless browser, and the proxy fallback that would let us read
                sites which refuse machines exists and stays switched off. A site being unreadable
                without those is the finding. Working around it would make the number flattering and
                useless.
              </p>
            </div>
          </div>
        </section>

        {/* WHAT TO DO ABOUT IT */}
        <section id="pricing" className="border-b border-hairline">
          <div className="mx-auto max-w-[1280px] px-6 py-24">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §02 · what to do about it
              </p>
              <h2 className="font-display mt-3 text-5xl text-balance text-foreground">
                Check it once, or watch it.
              </h2>
              <p className="mt-4 text-muted-foreground">
                The check above is free and always will be. Paid plans exist for people who need the
                reading repeated, at volume, through an API.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`rounded-md border p-7 ${p.featured ? "border-signal" : "border-hairline"} bg-background`}
                >
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      {p.name}
                    </div>
                    {p.featured && (
                      <div className="font-mono text-[10px] uppercase tracking-widest text-signal">
                        recommended
                      </div>
                    )}
                  </div>
                  <div className="font-display mt-3 text-5xl text-foreground">
                    {p.price}
                    <span className="text-base text-muted-foreground">/mo</span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{p.desc}</div>
                  <ul className="mt-6 space-y-2 text-sm text-foreground">
                    {p.feats.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-signal">→</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center font-mono text-xs text-muted-foreground">
              These three are the complete list. There is no enterprise tier, no support channel and
              no SLA, and we would rather say that here than let you find out later.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-hairline bg-surface/40">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-24 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §03 · questions
              </p>
              <h2 className="font-display mt-3 text-4xl text-foreground">Reasonable objections.</h2>
            </div>
            <div className="divide-y divide-hairline border-y border-hairline">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-4">
                    <span className="font-display text-xl text-foreground">{q}</span>
                    <span className="font-mono text-signal transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* THE API, QUIETLY */}
        <section className="border-b border-hairline">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              The same engine is a REST API and an MCP server, priced per call. It is the instrument
              behind the index, not the headline.
            </p>
            <a
              href="/docs"
              className="shrink-0 font-mono text-sm text-signal underline underline-offset-4"
            >
              Read the docs →
            </a>
          </div>
          <div className="mx-auto max-w-[1280px] px-6 pb-14">
            <pre className="overflow-x-auto rounded-md border border-hairline bg-surface p-5 font-mono text-xs leading-relaxed text-muted-foreground">
              {`curl -X POST ${API_BASE}/read_product \\
  -H "authorization: Bearer lgk_…" \\
  -d '{ "gtin": "${DEMO_GTIN}" }'`}
            </pre>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Entitlements are what the product actually enforces, nothing more.
 *
 * The previous version listed "Slack channel" and "SLA" on the top tier. Neither exists,
 * llms.txt already said so in writing, and they are dev-tool perks aimed at a buyer this
 * page is no longer written for. The quotas below are the values in the plans table, which
 * is what entitlementCheck reads at request time, so the page and the enforcement cannot
 * disagree.
 */
const PLANS = [
  {
    name: "Free",
    price: "$0",
    desc: "1,000 trusted reads per month, no card",
    feats: ["Unlimited domain checks", "REST and MCP access", "Hard stop, never a surprise bill"],
  },
  {
    name: "Starter",
    price: "$29",
    desc: "5,000 trusted reads, $0.01 per read after",
    feats: ["Higher rate limits", "Per-field confidence", "Priority email"],
    featured: true,
  },
  {
    name: "Growth",
    price: "$199",
    desc: "50,000 trusted reads, $0.005 per read after",
    feats: ["Highest rate limits", "Per-field confidence", "Priority email"],
  },
];
