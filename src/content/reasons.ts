import { FAILURE_REASONS, type FailureReason } from "@/lib/api/readability";

/**
 * Page-length content for each failure reason.
 *
 * REASON_COPY says what was found and REASON_FIX says what would change it. Both are one
 * sentence, because both are rendered inside a result card. This is the same eight findings
 * at the length someone needs when they have been handed one and are trying to work out
 * whether it matters and who has to do something about it.
 *
 * It lives here rather than in lib/api because it is content: prose that gets indexed and
 * quoted. It is keyed by FailureReason, so the three files cannot disagree about which
 * findings exist, and scripts/check-geo.ts scans it for the same banned register as the front
 * page, because these pages are the part of the site an answer engine is most likely to lift.
 *
 * Every page states the cost honestly, including where the honest answer is that there is no
 * cost. Two of the eight are not problems, and saying so is what makes the other six worth
 * believing.
 */

export type ReasonPage = {
  /** The h1. A finding, not a keyword. */
  title: string;
  /** The meta description and the opening line. One sentence, no hedging. */
  summary: string;
  /** What is actually happening, mechanically. */
  what: string[];
  /** What it costs commercially, including "nothing" where that is true. */
  cost: string[];
  /** Who fixes it and roughly how much work it is. */
  effort: string;
};

export const REASON_PAGES: Record<FailureReason, ReasonPage> = {
  blocked: {
    title: "The site refused the request",
    summary:
      "The server answered a plain request with a refusal rather than a page. That is a decision the site made, and it is often the right one.",
    what: [
      "A request arrived carrying an identified user agent and no browser fingerprint, and the server returned 401, 403 or 429, or a 200 whose body is a challenge page rather than the site. Either way nothing readable came back.",
      "This is usually a bot rule at a CDN or a firewall rather than a line someone wrote about this crawler specifically. Rules aimed at scrapers and credential stuffers catch every non-browser request, and an answer engine's crawler is a non-browser request.",
      "We record a refusal only when a second independent request path reproduces it. A single refusal that one client sees and another does not is recorded as inconclusive, because a refusal names a company and one client's word is not enough to publish that.",
    ],
    cost: [
      "If the refusal is intended, none. Choosing not to be read by machines is a legitimate position and plenty of publishers hold it deliberately.",
      "If it is not intended, it is the most complete version of the problem: an assistant asked about your products gets nothing at all and answers from a marketplace listing, a review aggregator or a competitor instead.",
      "Nothing about this appears in your analytics, because the request that failed was never a session and the visit that went elsewhere never happened.",
    ],
    effort:
      "Whoever owns the CDN or WAF configuration. Minutes to see what the rule does, longer to decide what you want it to do.",
  },

  js_shell: {
    title: "The content is assembled by JavaScript",
    summary:
      "The page arrived, but the facts on it are built in the browser after load. A crawler that does not run scripts sees an empty frame.",
    what: [
      "The HTML came back successfully and contained almost no readable text: markup, script tags and a mount point, with the content fetched and rendered afterwards by the application.",
      "A browser does the remaining work and a person sees a complete page. A crawler that does not execute JavaScript sees what the server actually sent, which is close to nothing.",
      "This is the most common finding on modern commerce sites, and it is nearly always an accident of the framework rather than a decision anyone made.",
    ],
    cost: [
      "An assistant reading your product page finds no product. It will still answer the question it was asked, from whichever source it could read, which is usually a retailer carrying your item or a competitor carrying something close to it.",
      "The cost scales with how much of your catalogue is affected, which for a client-rendered site is normally all of it at once.",
      "It is also invisible in the usual places: nothing bounces, nothing times out, and no session is recorded, because the reader was never a session.",
    ],
    effort:
      "A frontend or platform engineer. Server-side rendering, static generation, or a prerender layer for crawlers all solve it. The test is one command: fetch your own page with curl and read what comes back.",
  },

  no_structured_data: {
    title: "The page has no structured data",
    summary:
      "The page reads fine as prose and carries nothing typed, so a machine has to infer what any of it means. Inference is where models invent things.",
    what: [
      "The HTML came back, it contains real readable text, and it has no JSON-LD block and too few OpenGraph tags to work with.",
      "Everything on the page is available to a model only as prose it has to interpret. Which number is the price, whether that price is current, which of the words is the brand and which is the model, are all guesses.",
      "A guess that is right is indistinguishable from a guess that is wrong until someone acts on it.",
    ],
    cost: [
      "Your facts get restated approximately. Prices attach to the wrong variant, availability is asserted from a sentence that was true last quarter, and the brand name comes out as whatever appeared closest to the product name.",
      "Where a competitor on the same query does publish typed data, theirs is the version that can be stated with confidence, so theirs is the version that gets stated.",
    ],
    effort:
      "One script tag in the head, and whoever owns the page template can add it. A schema.org Product block carrying name, brand, price, currency and availability is the single highest-value change on this list.",
  },

  not_a_product: {
    title: "The page is not a product page",
    summary:
      "The page was read successfully. Nothing on it identifies it as a product, because it probably is not one.",
    what: [
      "The read worked and the markup carried no indication that this page describes something purchasable.",
      "For a homepage, a category listing, an article or an about page, that is correct and expected. The check requests one page, and on most sites that page is not a product page.",
      "Where it is wrong is a genuine product page whose markup does not say so, which reads to a machine exactly like a page about nothing in particular.",
    ],
    cost: [
      "For a page that is not a product, none at all. This is a description rather than a fault.",
      "For a product page that does not identify itself, the same cost as carrying no structured data: an assistant asked about that item does not find it here.",
    ],
    effort:
      "Nothing, unless the page is meant to be a product. If it is, a schema.org Product block is what closes the gap.",
  },

  low_confidence: {
    title: "The extraction did not clear the trust gate",
    summary:
      "Typed data was there and something was extracted, but not well enough to rely on, so nothing is returned rather than something uncertain.",
    what: [
      "The extraction produced a result whose calibrated confidence landed below 0.7, which is the gate at which a read is treated as trustworthy.",
      "The usual causes are specific and fixable: a price with no currency attached, a product name that differs between the markup and the visible page, or several structured blocks on one page that disagree with each other.",
      "Below the gate the answer is withheld rather than returned with a caveat. A number that is probably right is worse than no number, because it gets used.",
    ],
    cost: [
      "You have done most of the work and are getting none of the benefit. The markup exists, and the disagreement inside it is enough to make the whole page unusable to anything that checks before it answers.",
      "Anything that does not check before it answers will use it anyway, which is the worse outcome of the two.",
    ],
    effort:
      "Whoever owns the product template. Usually a small correction rather than new work, because the markup is already there.",
  },

  timeout: {
    title: "The page did not answer in time",
    summary:
      "Twelve seconds passed without a response. No verdict about the markup is possible, because no markup arrived.",
    what: [
      "The request was made and nothing came back within the budget. This is a statement about the response, not about the page.",
      "It can be transient. It can also be what a plain server request from a datacenter address consistently gets, when a browser from a residential one does not.",
      "Nothing is recorded about your structured data, because none of it was seen.",
    ],
    cost: [
      "Directly, only that this read produced nothing. Worth repeating before drawing any conclusion from it.",
      "Indirectly, it is worth knowing that most crawlers budget less time than twelve seconds. A page that takes that long here has already been abandoned by several of them.",
    ],
    effort:
      "Whoever watches origin response times. Start by checking what the origin does for an uncached request with no browser headers.",
  },

  robots_disallowed: {
    title: "robots.txt asked us not to read the page",
    summary:
      "Your robots.txt disallows this crawler, so the page was never requested. That is recorded as a finding and never worked around.",
    what: [
      "robots.txt is fetched before anything else. When it disallows the path, no request for the page is made at all.",
      "Groups in robots.txt are not additive: the most specific matching group wins outright and the wildcard group is then ignored entirely. A rule written for one named crawler can silently stop applying to everything else, and the reverse.",
      "A disallow is published as a data point. Routing around it would make every number this product publishes worthless.",
    ],
    cost: [
      "If the rule was meant, none. Asking not to be read is a legitimate choice and we record it as a choice rather than a failure.",
      "If the rule was broader than intended, the cost is the same as a refusal: assistants answering questions about your products answer from somewhere else. A disallow aimed at one badly behaved scraper is often written in a way that covers every non-browser request, including the ones that would have cited you.",
    ],
    effort:
      "Whoever owns robots.txt. Reading it carefully is most of the work, because the group precedence rule surprises people.",
  },

  error: {
    title: "The result was inconclusive",
    summary:
      "Something went wrong that we cannot attribute to your site. We would rather say we do not know than publish a finding we cannot stand behind.",
    what: [
      "This covers the cases where the read failed for a reason that is not evidence about the page: an unexpected status, a connection that did not complete, or a refusal that one request path saw and a second did not.",
      "That last case is the important one. During development a plain request received 403 from two well-known newspapers while a different client received 200 and 302 from the same machine seconds apart. The difference was the HTTP client, not the sites. Recording the first would have published a false accusation against both.",
      "So when the evidence disagrees with itself, the verdict is this one rather than the more interesting one.",
    ],
    cost: [
      "None that can be established from this read. Anyone treating it as a problem with your site is reading more into it than it says.",
      "Run it again. If it settles into a specific finding, that finding is the one to act on.",
    ],
    effort: "Nothing yet. The honest response to an inconclusive read is another read.",
  },
};

/** Ordered for the hub page: the findings that cost something, before the ones that do not. */
export const REASON_PAGE_ORDER: FailureReason[] = [
  "js_shell",
  "no_structured_data",
  "blocked",
  "low_confidence",
  "robots_disallowed",
  "not_a_product",
  "timeout",
  "error",
];

// The order must be a permutation of the closed set, not a second hand-maintained list that
// drifts from it. Checked at module load, so a reason added to FAILURE_REASONS without being
// placed here fails immediately rather than quietly vanishing from the hub page.
if (REASON_PAGE_ORDER.length !== FAILURE_REASONS.length) {
  throw new Error("REASON_PAGE_ORDER must list every FailureReason exactly once.");
}
