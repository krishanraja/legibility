# 03 Outreach Sequences

Ready-to-send, agent-executable outreach. This file is the `outreach` stage of
the pipeline in `00-operating-brief.md`. It assumes the prospect already
cleared the three qualification gates and zero disqualifiers in
`01-icp-and-targeting.md` / `04-demo-and-qualification.md`. If they have not,
do not send anything: log the reason and drop.

Two hard rules govern every template here:

1. **Lead with a real read.** Before you send any message, run `read_product`
   or `resolve_product` on one of the prospect's real target URLs (or a
   known-good proof URL) and paste the object that actually came back. Never
   send copy that describes Legibility without showing a live result. Never mock.
2. **End with one ask.** Either a 15-minute call or the design-partner ask.
   One clear next step per message, never two.

No em dashes anywhere. Use commas, periods, colons, or "to" for ranges. Sweep
every generated draft before it sends.

Last reviewed: 2026-07-06.

---

## 1. Pre-send gate (run this before generating any message)

Do not skip. Each check is pass/fail. Any fail stops the send.

| # | Check | Pass condition | On fail |
|---|---|---|---|
| G1 | Qualification | All 3 gates true, 0 disqualifiers (per `04`). | Do not send. Mark `disqualified`, log reason, stop. |
| G2 | Real read run | You ran `read_product`/`resolve_product` in the last 24h and have the returned object in hand. | Run it now. If you cannot get a >= 0.7 read on their domain or a proof URL, do not send. |
| G3 | Proof is honest | The read you will paste returned confidence >= 0.7 and is real. | If their targets returned null/low (hard retailers), use a known-good proof URL and say so plainly. If their whole target list is hard retailers, that is disqualifier D1: stop. |
| G4 | Personalization line | You have one specific, researched sentence about this prospect (not generic). | Do the research or drop the prospect. No generic sends. |
| G5 | Not suppressed | Prospect is not on the do-not-contact list and has not opted out. | Stop permanently. |
| G6 | Channel fit | Email address is a real work address, or the channel (LinkedIn/community) permits outreach. | Pick a permitted channel or stop. |

Decision rule: send only if G1 through G6 all pass. Log the pass in the CRM row
(`07-metrics-crm-and-loop.md`) before the first touch.

---

## 2. Merge fields (used by every template)

Fill all of these before assembling a message. A template with an unresolved
`{{field}}` must never send.

| Field | Meaning | Where the agent gets it | Example |
|---|---|---|---|
| `{{first_name}}` | Prospect first name | Enrichment / profile | Dana |
| `{{company}}` | Company or project name | Enrichment | Cartpilot |
| `{{signal}}` | Detected signal code (Section 3) | Your scoring pass | `PAYS_EXTRACTION` |
| `{{signal_evidence}}` | The specific thing you saw | Research | "job post lists Firecrawl + Playwright" |
| `{{personalization_line}}` | One researched sentence, prospect-specific | Research (Section 4.1) | See 4.1 examples |
| `{{wedge_line}}` | The signal-keyed why-you sentence | Section 3 table | See 3.2 |
| `{{proof_url}}` | The URL or GTIN you read | Their target list or proof set | `lego.com/.../75192` |
| `{{proof_product_name}}` | Name from the returned object | The live read | LEGO Millennium Falcon |
| `{{proof_price_band}}` | Price band from the object | The live read | $849.99 |
| `{{proof_confidence}}` | Top-line confidence | The live read | 0.88 |
| `{{proof_method}}` | Source method | The live read | web_unlocker |
| `{{proof_cost}}` | Per-call cost stamped in | The live read | $0.006 |
| `{{current_stack}}` | Extraction tools they pay for | Research | Diffbot |
| `{{their_target_domain}}` | The domain they most need to read | Research | supplier catalogues |
| `{{sender_name}}` | Sender | Fixed | Krish |
| `{{calendar_link}}` | 15-min booking link | Fixed | (booking link) |

Fixed surface facts to paste as-is: docs at `https://legibility.io/docs`, MCP at
`https://legibility.io/api/mcp`. Never reference `onplinth.io`,
`plinth-tan.vercel.app` or `plinth.sh`; they are dead.

---

## 3. Signal routing (pick the wedge before you write)

### 3.1 Detect the signal

Score the prospect into exactly one primary signal. If two apply, pick the one
highest in this table (top = strongest wedge). `PROCUREMENT_LONGTAIL` is the
moat-critical segment: if it applies at all, it wins and you route the
design-partner ask earlier (Touch 2, not Touch 3).

| Priority | Signal code | Evidence to look for | Proof read to run |
|---|---|---|---|
| 1 | `PROCUREMENT_LONGTAIL` | B2B procurement copilot, supplier/distributor catalogues, long-tail or wholesale domains, "buy for me" over non-consumer sites, audit/compliance language | A real reachable target URL from their supplier list; else LEGO proof URL |
| 2 | `BUILDS_BUYFLOW` | Ships a shopping agent, buy-this-for-me, comparison agent, cart/checkout copilot | One of their real product targets; else Allbirds $110 |
| 3 | `PAYS_EXTRACTION` | Job post / BuiltWith / GitHub deps show Diffbot, Firecrawl, ScrapingBee, Zyte, Bright Data, Apify | A Shopify/JSON-LD target they read today; else Sony WH-1000XM5 |
| 4 | `HANDROLLS_SCRAPING` | Public repo with Playwright + JSON-LD parsing, blog post on scraping product pages, a home-grown extractor | A URL from their own examples; else Coca-Cola GTIN |
| 5 | `SHIPS_MCP` | Publishes an MCP server, agent framework, or tool registry looking for paid tools | Same call via `/api/mcp` so you can cite the MCP path |

### 3.2 The wedge line per signal (paste into `{{wedge_line}}`)

- `PROCUREMENT_LONGTAIL`: "For an autonomous buy you need two things a scraper does not give you: a confidence you can gate on before you spend money, and an audit trail. Legibility returns a calibrated confidence per field and a stable `legibility_id` per product you can store in your own schema."
- `BUILDS_BUYFLOW`: "Any agent that buys or compares physical products hits the same wall: reading the product page reliably enough to act on. That is the entire job Legibility does."
- `PAYS_EXTRACTION`: "You already have a budget line for reading product pages with {{current_stack}}. The gap it leaves is a calibrated confidence you can gate on and the cost of each call, which Legibility stamps into every response."
- `HANDROLLS_SCRAPING`: "You are currently owning the schema, the JSON-LD parse, the cache, the price-band logic, and the is-this-a-product check. Legibility is that stack, finished, behind one call."
- `SHIPS_MCP`: "Legibility is a native MCP tool at legibility.io/api/mcp, so an agent on {{company}} can discover it and call `read_product` or `resolve_product` with no extractor to build."

---

## 4. Cold email sequence (4 touches)

### 4.0 Cadence

| Touch | When | Purpose | Ends with |
|---|---|---|---|
| 1 | Day 0 | Real read + wedge | 15-min call |
| 2 | Day +3 | New angle + proof/docs (design-partner ask if `PROCUREMENT_LONGTAIL`) | 15-min call or partner ask |
| 3 | Day +7 | The design-partner ask, explicit | Design-partner ask |
| 4 | Day +13 | One-line breakup | Permission to close the thread |

Stop rules apply at all times (Section 8): any reply routes to the matrix and
pauses the sequence; opt-out stops permanently; stop after Touch 4.

### 4.1 The personalization line (fill `{{personalization_line}}`)

One sentence, specific to this prospect, grounded in something you actually
found. It proves you did the work. Rules: name the concrete thing, no flattery,
no "I love what you are building," under 25 words.

Good examples:
- "Saw {{company}}'s changelog shipped a compare-prices step last week; that is exactly the read that breaks on half of retailers."
- "Your repo's `extractor.ts` hand-parses JSON-LD and falls back to a regex on price; that fallback is where confidence gets silently wrong."
- "Your job post lists Firecrawl and a Playwright pool, which is the two-tool setup Legibility collapses into one typed call."

Bad (do not send): "I love what you're building at {{company}}." / "Hope this
finds you well." / anything you cannot cite.

### 4.2 Touch 1 (Day 0)

Subject line, pick one (keep under 55 chars, lowercase-lead, no hype):
- `typed read for {{their_target_domain}}, confidence stamped in`
- `read {{proof_product_name}} at {{proof_confidence}} just now`
- `{{company}}'s agent + reading product pages`

Body:

```
Hi {{first_name}},

{{personalization_line}}

{{wedge_line}}

I ran Legibility on {{proof_url}} a minute ago. It returned {{proof_product_name}},
price band {{proof_price_band}}, method {{proof_method}}, confidence
{{proof_confidence}}, with the call cost ({{proof_cost}}) stamped into the
response. One call over REST or MCP gives you a typed object with a calibrated
confidence per field, so 0.7 means about 70% likely correct and you gate on it.
You only pay when a read clears that 0.7 gate, so nulls and low-confidence
answers are free.

Worth 15 minutes to run it against your real target list? {{calendar_link}}

{{sender_name}}
legibility.io/docs
```

### 4.3 Touch 2 (Day +3)

Subject: reply in the same thread (blank/`Re:`), or if new:
- `the part that is not shipped yet`
- `where Legibility stops working, honestly`

Body (default):

```
Hi {{first_name}}, following up with the honest boundary, since it usually
saves a call.

Legibility returns trusted objects today on Shopify, barcodes/GTIN, cooperating
JSON-LD, and hard retailers through a Web Unlocker (Nike, Lego, MediaMarkt are
verified). Apple and a few top-tier anti-bot sites are best-effort: they return
a graceful null at no charge, not a made-up object. Price is a band, not a live
spot guarantee. If your targets are mostly Amazon or Apple, I will tell you
before you spend a cent.

If your targets are the reachable kind, the calibrated confidence is the reason
to switch: it is scored against a labelled golden set, per field, not a coverage
proxy. Gate hard at 0.9 on `gtin`, accept 0.6 on `category`.

15 minutes this week? {{calendar_link}}

{{sender_name}}
```

Body override if `{{signal}} == PROCUREMENT_LONGTAIL` (bring the partner ask
forward):

```
Hi {{first_name}}, one thing specific to autonomous procurement.

Every Legibility object carries an opaque, stable `legibility_id`. Store it as a foreign
key in your own schema, then call POST /api/v1/report_outcome when a Legibility
answer led to a real buy at the stated price. That gives you a clean audit
trail of what your agent read, trusted, and acted on, per product, over time.

We are taking on 2 to 3 design partners on supplier and long-tail domains. You
get free access with real headroom, a private Slack with me, and priority on
your domains. In return you store the `legibility_id` and wire report_outcome. That
is the whole ask.

Worth 15 minutes to see if {{company}} is a fit? {{calendar_link}}

{{sender_name}}
```

### 4.4 Touch 3 (Day +7): the design-partner ask, explicit

Subject:
- `design partner slot for {{company}}`
- `the ask, in two lines`

Body:

```
Hi {{first_name}}, making the ask directly so you can decide fast.

I am taking on 2 to 3 design partners building agent buy-flows. What you get:
free or heavily discounted access with generous trusted-read headroom, direct
support from me in a private Slack channel, and priority engineering on your
target domains.

What I ask: (1) store the opaque `legibility_id` as a foreign key in your schema,
(2) wire POST /api/v1/report_outcome on real buys, (3) a short recurring
check-in on misses. A logo or reference later, only once it has earned it.

If that fits, reply and I will send a shared doc and a first read against your
top 10 targets. If not, tell me and I will close the thread. {{calendar_link}}

{{sender_name}}
```

### 4.5 Touch 4 (Day +13): breakup

Subject: `Re:` the thread, or `closing this out`.

Body:

```
Hi {{first_name}}, I will stop here so I am not cluttering your inbox.

If reading product pages reliably ever becomes the thing slowing your agent
down, the typed object and the confidence gate are at legibility.io/docs and the
door is open. Real read on {{proof_url}} is still {{proof_confidence}}
confidence if you want to check.

All the best with {{company}}.

{{sender_name}}
```

---

## 5. LinkedIn connect + follow-up variant

Use when you have no work email or the prospect is more reachable on LinkedIn.
Same pre-send gate applies.

### 5.1 Connect note

Keep under 200 characters (free-tier limit). No links (they suppress reach).

```
Hi {{first_name}}, saw {{signal_evidence}}. I built Legibility: URL, GTIN, or name
in, a typed product object out with calibrated confidence per field, REST +
MCP. Ran it on {{proof_product_name}} at {{proof_confidence}}. Fit for
{{company}}?
```

### 5.2 Follow-up 1 (on accept, same day)

```
Thanks for connecting. Concretely: I ran Legibility on {{proof_url}} and it came
back {{proof_product_name}}, {{proof_price_band}}, method {{proof_method}},
confidence {{proof_confidence}}, with the {{proof_cost}} call cost in the
response. You only pay when a read clears the 0.7 gate, nulls are free.

{{wedge_line}}

Want me to run it against your real target list? 15 min or async, your call.
```

### 5.3 Follow-up 2 (Day +5, if no reply)

```
No pressure {{first_name}}. If it is useful: the moat feature is a stable
legibility_id you store in your own schema plus a report_outcome endpoint, so your
agent has an audit trail of what it read and bought. We are onboarding 2 to 3
design partners on that. Open to a quick look? Otherwise I will leave it here.
```

Stop after Follow-up 2 on LinkedIn. Do not send a third.

---

## 6. Community / DM variant (agent-framework Discords, forums)

For places where ICP devs gather (MCP, agent-framework, and extraction
communities). These channels punish spam, so value-first is not optional.

### 6.1 Rules (all must hold before you post)

| Rule | Requirement |
|---|---|
| On-topic | Someone is actively discussing product data, extraction, scraping reliability, or MCP tools. |
| Permitted | The channel allows tool mentions / self-promo, or you are answering a direct question. |
| Value first | Your message helps even if they never touch Legibility. |
| One mention | Mention Legibility once, with a real read, then stop. No repeat pitching in-thread. |
| Disclose | You are the builder. Say so. |

If any rule fails, do not post. DM only if the person invited it or asked a
question you can answer with a real result.

### 6.2 Helpful reply template (public, in-thread)

```
If the pain is reading product pages reliably enough to act on: I build Legibility,
so treat this as biased. The thing that helped us was gating on a calibrated
confidence per field instead of trusting a scrape. Example, I just ran it on
{{proof_url}}: {{proof_product_name}}, {{proof_price_band}}, confidence
{{proof_confidence}}, call cost stamped in. Honest limit: Apple and a few
anti-bot heads return a graceful null, not a guess. Docs: legibility.io/docs.
Happy to run it on a URL you care about.
```

### 6.3 DM template (only if invited or after they engaged)

```
Hey {{first_name}}, following up from {{signal_evidence}}. Ran Legibility on
{{proof_url}}: {{proof_product_name}} at {{proof_confidence}} confidence,
{{proof_price_band}}, {{proof_cost}} cost in the response. One typed call, REST
or MCP, pay only past the 0.7 gate. If you are building a buy-flow at
{{company}}, we are taking 2 to 3 design partners: free access with headroom in
exchange for storing the legibility_id and wiring report_outcome. Worth 15 min?
```

---

## 7. Reply-handling matrix

Any reply pauses the sequence. Classify the reply, then act. Never continue the
scheduled cadence on top of a live reply.

| Reply type | Trigger signals | Action | Response |
|---|---|---|---|
| Interested | "tell me more", "send docs", "how much", "let's talk", books time | Move to `demo`/`qualify` (`04`), stop the sequence, mark `engaged` | Template 7.1 |
| Not now | "circle back in Q_", "busy", "not a priority yet" | Pause 30 days, set a single follow-up, mark `nurture` | Template 7.2 |
| Objection | "Diffbot does this", "we use Firecrawl + GPT", "does it do Apple", "confidence, why trust it", "x402 risky" | Answer with the matched line from `05`, re-offer the call | Template 7.3 + route to `05` |
| Referral | "talk to {{name}}", "not me, our eng lead" | Thank, ask for a warm intro, start a new gated row for the referral | Template 7.4 |
| Not a fit | "we only do Amazon", "we track prices over time", "need live checkout" | Confirm disqualifier, thank, stop, log the reason | Template 7.5 |
| Opt-out | "unsubscribe", "stop", "remove me", "do not contact" | Add to do-not-contact, stop permanently, no reply that re-pitches | Template 7.6 |

### 7.1 Interested

```
Great. Fastest path: send me one or two real target URLs and I will run them
live before we talk, so the call is your data, not a slide. Grab 15 min here
{{calendar_link}} or reply with the URLs and I will send the objects back async.
```

### 7.2 Not now

```
Understood, no push. I will check back in {{month}}. If it gets urgent before
then, the typed read and the confidence gate are at legibility.io/docs and you
can self-serve the free tier (1,000 trusted reads, no card).
```

### 7.3 Objection (lead-ins; full matrix in `05`)

- "Diffbot does this": "Diffbot returns a typed object. It does not return a calibrated confidence per field, does not stamp cost in the response, has no MCP surface, and cannot be paid by an agent. That is the gap. Want me to run the same URL on both?"
- "We use Firecrawl + GPT": "You can, and then you own the schema, the cache, the calibration harness, the price-band logic, the barcode merge, and the is-product check. Legibility is that stack, finished, billed only past the 0.7 gate. The cost on every response makes the build-vs-buy math quick."
- "Does it do Apple / Amazon": "Not reliably, and I will not pretend it does. Structured retailers, barcodes, and cooperating JSON-LD return trusted objects now, plus hard retailers via the unlocker (Nike, Lego, MediaMarkt verified). Apple is best-effort with a graceful null. If your list is mostly Apple/Amazon, we are not a fit and I will say so."
- "Why trust the confidence": "It is calibrated against a labelled golden set, per field, not a coverage proxy. 0.7 means about 70% likely correct. Gate hard at 0.9 on `gtin`, accept 0.6 on `category`. Most vendors give you one number or none."
- "x402 sounds risky": "It is testnet only (Base Sepolia), opt-in, and you can ignore it entirely and pay by card. No mainnet settlement has happened. The agent-pay surface is a bonus, not a dependency."

End every objection reply with: "Still worth 15 minutes? {{calendar_link}}"

### 7.4 Referral

```
Thanks {{first_name}}, that helps. Happy to take it to {{name}}. A one-line
intro from you lands better than a cold note from me, but either works. In the
meantime I will run a real read on {{company}}'s target so {{name}} has
something concrete, not a pitch.
```

### 7.5 Not a fit

```
Appreciate the straight answer. That is genuinely outside what Legibility does well
today ({{reason}}), so I will not waste your time. If your targets shift toward
structured retail, barcodes, or supplier catalogues, the door is open. Best of
luck with {{company}}.
```

### 7.6 Opt-out

```
Done, removed. Sorry for the noise. All the best.
```

No further contact, ever. Add to do-not-contact immediately.

---

## 8. Cadence and stop rules

### 8.1 Timing

- Email: Day 0, +3, +7, +13. Four touches total.
- LinkedIn: connect, then Follow-up 1 on accept, Follow-up 2 at +5. Two
  messages after connect, then stop.
- Community/DM: one public helpful reply; DM only if invited; never a second
  DM without engagement.
- Send email on business days, sender-local business hours. Slide a touch to the
  next business day rather than sending on a weekend.

### 8.2 Stop conditions (any one halts the sequence)

| Condition | Action |
|---|---|
| Any reply | Pause cadence, route to Section 7. |
| Opt-out / unsubscribe / "stop" | Stop permanently, add to do-not-contact, no re-pitch reply. |
| Meeting booked | Stop cadence, move to `demo` (`04`). |
| Touch 4 sent, no reply | Stop. Mark `closed_no_reply`. Eligible for re-approach in 90 days only with a new signal. |
| Disqualifier surfaces mid-thread | Stop, send 7.5, log the disqualifier. |
| Hard bounce / invalid address | Stop, mark `bad_contact`, try one alternate channel max. |
| Prospect asks for cadence to slow | Honor it exactly. Reset to their stated interval. |

### 8.3 Suppression and hygiene

- One sequence per prospect at a time. Never run email and LinkedIn cadences in
  parallel on the same person.
- Log every touch and every reply to the CRM row before the next action
  (`07-metrics-crm-and-loop.md`).
- Do not contact the same prospect on two signals inside 90 days.
- If a company has an active thread with any contact, do not cold a second
  contact at that company until the first thread closes.

---

## 9. Fully worked example (assembled reference)

Shows a complete assembly so an agent can pattern-match. All values are real per
the canonical proof set.

- Prospect: Dana at Cartpilot, ships a "buy-this-for-me" agent.
- Signal detection: product is a shopping agent to `BUILDS_BUYFLOW`. Not
  procurement long-tail, so partner ask stays at Touch 3.
- Pre-send gate: G1 pass (buy-flow, pays for a scraper, targets are Shopify +
  brand sites), G2 real read run, G3 proof honest, G4 personalization found, G5
  not suppressed, G6 work email.
- Real read: ran `read_product` on the LEGO Millennium Falcon URL; got
  "LEGO Millennium Falcon", band $849.99, method `web_unlocker`, confidence
  0.88, cost $0.006.

Assembled Touch 1:

```
Subject: read LEGO Millennium Falcon at 0.88 just now

Hi Dana,

Saw Cartpilot's demo add a "compare across stores" step last week; that is
exactly the read that breaks on half of retailers.

Any agent that buys or compares physical products hits the same wall: reading
the product page reliably enough to act on. That is the entire job Legibility does.

I ran Legibility on lego.com's Millennium Falcon page a minute ago. It returned LEGO
Millennium Falcon, price band $849.99, method web_unlocker, confidence 0.88,
with the call cost ($0.006) stamped into the response. One call over REST or MCP
gives you a typed object with a calibrated confidence per field, so 0.7 means
about 70% likely correct and you gate on it. You only pay when a read clears
that 0.7 gate, so nulls and low-confidence answers are free.

Worth 15 minutes to run it against Cartpilot's real target list? (booking link)

Krish
legibility.io/docs
```

That is the standard. Every send should read this concrete, this honest, and
end with exactly one ask.
