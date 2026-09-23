import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getIndex, type CohortRow, type DomainRow } from "@/lib/api/index.functions";
import { REASON_COPY, type FailureReason } from "@/lib/api/readability";
import { bucket as sum, CHOSEN, DEFECT, INCONCLUSIVE } from "@/lib/api/cohort";
import { APP_ORIGIN, BOT_TOKEN } from "@/config/product";

/**
 * The published index.
 *
 * llms.txt has advertised this since the repositioning and there has never been a page,
 * because no sweep had run against egress anyone trusted. One has now, and every refusal it
 * records was corroborated against production before a row was written.
 *
 * The presentation carries one analytical decision that the raw percentage does not. A site
 * that refuses a plain request and a site that renders only in JavaScript are both
 * "unreadable", and reporting them as one number would be the overclaim this whole product
 * argues against: six of the eight news failures here are publishers deliberately refusing
 * machines, which is a choice they are entitled to make, not a defect. So the page splits
 * what it found into refusal, defect and inconclusive, and puts the honest headline on the
 * defect column rather than the total.
 *
 * Every figure comes from cohort_readability, which is a view over the raw observations, so
 * dropping and rebuilding it reproduces the page exactly. The sample is twenty sites and the
 * page says twenty sites, everywhere, in the same breath as the percentage.
 */

export const Route = createFileRoute("/readability")({
  loader: () => getIndex(),
  head: ({ loaderData }) => {
    const total = (loaderData?.cohorts ?? []).reduce((n, c) => n + c.observations, 0);
    const chosen = (loaderData?.cohorts ?? []).reduce((n, c) => n + sum(c, CHOSEN), 0);
    const defect = (loaderData?.cohorts ?? []).reduce((n, c) => n + sum(c, DEFECT), 0);
    const description = total
      ? `Of ${total} well-known sites read once each with a plain request, ${chosen} refuse machines by choice and ${defect} could be read and are not. Method, sample size and every per-site verdict published.`
      : "The machine-readability index over a fixed cohort of well-known sites.";
    return {
      meta: [
        { title: "The machine readability index · Legibility" },
        { name: "description", content: description },
        { property: "og:title", content: "The machine readability index · Legibility" },
        { property: "og:description", content: description },
        { property: "og:url", content: `${APP_ORIGIN}/readability` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: "Legibility machine readability index",
            description,
            url: `${APP_ORIGIN}/readability`,
            isAccessibleForFree: true,
            creator: { "@id": `${APP_ORIGIN}/#org` },
            measurementTechnique:
              "One plain HTTP GET of each site's homepage with an identified user agent, no headless browser and no proxy fallback, classified into a closed set of eight outcomes.",
            variableMeasured: "Whether typed facts can be extracted from the page without guessing",
          }),
        },
      ],
    };
  },
  component: IndexPage,
});

function when(iso: string | null) {
  return iso ? iso.slice(0, 10) : "not yet";
}

function DomainList({ rows }: { rows: DomainRow[] }) {
  return (
    <dl className="divide-y divide-hairline border-y border-hairline">
      {rows.map((d) => {
        const reason = d.failure_reason as FailureReason | null;
        return (
          <div
            key={d.domain}
            className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[210px_150px_1fr]"
          >
            <dt className="font-mono text-sm text-foreground">{d.domain}</dt>
            <dd className="font-mono text-xs text-signal">
              {d.readable ? (
                <span className="text-verified">readable · {d.method}</span>
              ) : reason ? (
                <Link to="/why/$reason" params={{ reason }} className="hover:underline">
                  {reason}
                </Link>
              ) : (
                "unknown"
              )}
            </dd>
            <dd className="text-sm text-muted-foreground">
              {d.readable
                ? "Typed facts were extracted without guessing."
                : reason
                  ? REASON_COPY[reason]
                  : ""}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function IndexPage() {
  const { cohorts, domains, lastRun } = Route.useLoaderData();

  if (!cohorts.length) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main id="main-content" className="mx-auto max-w-[820px] px-6 py-24">
          <h1 className="font-display text-5xl">No sweep has been recorded.</h1>
          <p className="mt-6 text-lg text-muted-foreground">
            There is no index to show yet. Rather than publish a zero, which would read as a finding
            about these sites, this page says plainly that nothing has been measured.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const total = cohorts.reduce((n, c) => n + c.observations, 0);
  const readable = cohorts.reduce((n, c) => n + c.readable, 0);
  const chosen = cohorts.reduce((n, c) => n + sum(c, CHOSEN), 0);
  const defect = cohorts.reduce((n, c) => n + sum(c, DEFECT), 0);
  const inconclusive = cohorts.reduce((n, c) => n + sum(c, INCONCLUSIVE), 0);
  const pct = (n: number) => Math.round((100 * n) / total);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-20">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              Machine readability index · read {when(lastRun?.finished_at ?? null)}
            </p>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] text-balance">
              {readable} of {total} well-known sites could be read by a machine.
            </h1>
            <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
              Each site's homepage was requested once, with one plain GET, identified as {BOT_TOKEN}
              , exactly as an answer engine's crawler would. No headless browser. No proxy to get
              around a refusal. Twenty sites is a small sample and every figure below says so.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-foreground">
              The total is the least interesting part of it. What matters is that these are three
              different findings wearing one word.
            </p>

            <dl className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
              {[
                [
                  "Chose not to be read",
                  chosen,
                  "Refused the request or disallowed it in robots.txt. A decision, and often a reasonable one.",
                ],
                [
                  "Could be read, and was not",
                  defect,
                  "Reachable and readable as a page, carrying nothing a machine can use without guessing.",
                ],
                [
                  "Inconclusive",
                  inconclusive,
                  "The read failed for reasons that are ours, not theirs. Counted against nobody.",
                ],
              ].map(([label, n, note]) => (
                <div key={label as string} className="bg-background p-5">
                  <dt className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="font-display mt-2 text-4xl text-foreground">
                    {n as number}
                    <span className="ml-2 text-base text-muted-foreground">of {total}</span>
                  </dd>
                  <dd className="mt-2 text-sm text-muted-foreground">{note}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 text-sm text-muted-foreground">
              The middle column is the one with a cost attached. {defect} of {total} sites,{" "}
              {pct(defect)} percent, are readable pages that a machine still cannot extract a fact
              from. That is the problem this product measures, and it is the only one of the three
              anybody can fix in an afternoon.
            </p>
          </div>
        </section>

        <section className="border-b border-hairline bg-surface/40">
          <div className="mx-auto max-w-[1280px] px-6 py-20">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              §01 · by cohort
            </p>
            <h2 className="font-display mt-3 text-4xl text-balance">
              News refuses on purpose. Retail mostly does not.
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {cohorts.map((c) => (
                <div key={c.cohort} className="rounded-md border border-hairline bg-background p-6">
                  <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-widest">
                    <span className="text-signal">{c.cohort}</span>
                    <span className="text-muted-foreground">{c.domains} sites</span>
                  </div>
                  <p className="font-display mt-3 text-3xl">
                    {c.readable} readable
                    <span className="text-base text-muted-foreground"> of {c.observations}</span>
                  </p>
                  <dl className="mt-4 space-y-1 border-t border-hairline pt-3 font-mono text-xs">
                    {(
                      [
                        ["chose not to be read", sum(c, CHOSEN)],
                        ["could be read, and was not", sum(c, DEFECT)],
                        ["inconclusive", sum(c, INCONCLUSIVE)],
                      ] as [string, number][]
                    ).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[1280px] px-6 py-20">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              §02 · every site
            </p>
            <h2 className="font-display mt-3 text-4xl text-balance">
              The whole cohort, with what was found.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Nothing is aggregated away. Each verdict links to what that finding means, what it
              costs and what would change it.
            </p>
            {cohorts.map((c) => (
              <div key={c.cohort} className="mt-10">
                <p className="font-mono text-xs uppercase tracking-widest text-signal">
                  {c.cohort}
                </p>
                <div className="mt-3">
                  <DomainList rows={domains.filter((d) => d.cohort === c.cohort)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-hairline bg-surface/40">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[280px_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                §03 · method and its limits
              </p>
              <h2 className="font-display mt-3 text-4xl text-balance">How this was measured.</h2>
            </div>
            <div className="space-y-5 text-muted-foreground">
              <p>
                One plain GET of each homepage, identified as {BOT_TOKEN}, with robots.txt checked
                first: a site that disallows us is recorded as having done so and its page is never
                requested. No headless browser, and the proxy fallback that would read sites which
                refuse machines exists and stays switched off, because a site being unreadable
                without it is the finding.
              </p>
              <p>
                A refusal is only recorded as a refusal when a second, independent request path
                reproduces it. Where the two disagree the verdict is inconclusive, because an index
                that cannot tell must say so rather than pick the more interesting answer. Every
                refusal published here was additionally corroborated against this site's own live
                checker before it was recorded.
              </p>
              <p className="text-foreground">
                The honest limits. Twenty sites is a small sample and a homepage is one page, so
                nothing here describes a whole catalogue. The cohort is fixed rather than random,
                chosen for being well known. A site can change between reads, and two of these did
                while this index was being built.
              </p>
              <p>
                <Link to="/why" className="text-signal underline underline-offset-4">
                  The eight findings, and what each one costs
                </Link>
                {" · "}
                <Link to="/about/bot" className="text-signal underline underline-offset-4">
                  What the crawler does
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto max-w-[820px] px-6 py-16">
            <p className="text-muted-foreground">
              Your own site is not in this cohort. The check on the front page reads it the same
              way, with the same classifier, and returns one of the same eight answers.
            </p>
            <a
              href="/#check"
              className="mt-5 inline-block rounded-sm bg-signal px-4 py-2 font-mono text-xs text-background hover:opacity-90"
            >
              See what a machine sees
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
