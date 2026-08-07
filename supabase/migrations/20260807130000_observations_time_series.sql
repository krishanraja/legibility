-- Outcome B: the system remembers WHY a read failed.
--
-- Until now a call was recorded in usage_events as "it happened, and roughly what came
-- back". A blocked request, a page that renders only in JavaScript, a page with no
-- structured data, a page that turned out not to be a product, a timeout, and a genuine
-- low-confidence extraction all collapsed into the same shape. Those are six different
-- findings with six different stories, and telling them apart is the product.
--
-- Why a new table rather than product_cache: cache_key there is UNIQUE with no history
-- column, a cron deletes from it every 30 minutes, and it has never held a row. A cache is
-- not a time series. The time series is the only asset here that cannot be recreated
-- later, so it gets its own append-only table.

-- ---------------------------------------------------------------- typed failure reasons
--
-- A check constraint rather than a Postgres enum: adding a value to an enum cannot run
-- inside a transaction with other DDL on some versions, and these categories will grow as
-- the cohort widens. The point is that the set is closed and the database rejects anything
-- outside it, so a sweep cannot quietly invent a seventh reason.

create table if not exists public.sweep_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  cohorts       text[]      not null,
  attempted     integer     not null default 0,
  succeeded     integer     not null default 0,
  failed        integer     not null default 0,
  blocked       integer     not null default 0,
  inserted      integer     not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  cost_cap_usd  numeric(12,6) not null,
  item_cap      integer     not null,
  status        text        not null default 'running'
                  check (status in ('running','ok','failed','capped')),
  notes         text
);

comment on table public.sweep_runs is
  'One row per sweep. Records what was attempted, what succeeded, what was blocked and what it cost, so a sweep that returns nothing fails loudly instead of passing quietly.';

create table if not exists public.observations (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.sweep_runs(id) on delete cascade,
  observed_at     timestamptz not null default now(),

  cohort          text not null,
  domain          text not null,
  target          text not null,

  -- How the read was performed. The worker already returns this and meter.ts parsed it out
  -- of the envelope and dropped it on the floor before storage. 'none' rather than NULL so
  -- the uniqueness index below actually dedupes: in Postgres NULLs are distinct, so a
  -- nullable column in a unique index would let identical failures insert forever.
  method          text not null default 'none',

  readable        boolean not null,
  failure_reason  text
    check (failure_reason is null or failure_reason in (
      'blocked',             -- the site refused the request. A choice the site made.
      'js_shell',            -- HTML arrived but the content renders only via JavaScript.
      'no_structured_data',  -- real HTML, no JSON-LD, no OpenGraph, nothing typed.
      'not_a_product',       -- read fine, but the page is not a product.
      'low_confidence',      -- extracted, but below the 0.7 trust gate.
      'timeout',             -- no answer in the budget.
      'robots_disallowed',   -- robots.txt said no. Recorded, never circumvented.
      'error'                -- anything else, so nothing is silently dropped.
    )),

  http_status     integer,
  confidence      numeric(4,3),
  robots_allowed  boolean not null,
  cost_usd        numeric(12,6) not null default 0,

  -- sha256 over the normalised extraction envelope. Two sweeps that find byte-identical
  -- content produce the same hash, and the unique index below turns the second one into a
  -- no-op. This is what makes "re-running the same sweep adds nothing" true by
  -- construction rather than by convention.
  envelope_hash   text not null,

  -- A readable row must carry no failure reason, and an unreadable row must carry one.
  -- Without this the table could hold rows that answer the product's central question
  -- with a shrug.
  constraint observations_reason_matches_outcome check (
    (readable and failure_reason is null) or (not readable and failure_reason is not null)
  )
);

comment on table public.observations is
  'Append-only time series of cohort sweeps. One row per (target, method, content-hash). The failure_reason column is the product: it distinguishes a site that blocked us from one that merely renders in JavaScript.';

-- The idempotency guarantee, stated as an index.
create unique index if not exists observations_dedupe
  on public.observations (target, method, envelope_hash);

create index if not exists observations_cohort_observed
  on public.observations (cohort, observed_at desc);
create index if not exists observations_domain_observed
  on public.observations (domain, observed_at desc);
-- Partial index: the failure queries are the ones that run constantly, and they only ever
-- look at unreadable rows.
create index if not exists observations_failure_reason
  on public.observations (failure_reason, observed_at desc) where not readable;
create index if not exists observations_run
  on public.observations (run_id);

-- ------------------------------------------------------------------------ derived views
--
-- Derived, never stored. Dropping and recreating these reproduces identical output from
-- the raw rows, which is the "rebuilding derived views from raw data reproduces identical
-- output" requirement.

-- The single query the brief asks for: after any sweep, how many of these sites could not
-- be read, and for which distinct reasons.
create or replace view public.cohort_readability as
select
  o.cohort,
  o.run_id,
  count(*)                                            as observations,
  count(distinct o.domain)                            as domains,
  count(*) filter (where o.readable)                  as readable,
  count(*) filter (where not o.readable)              as unreadable,
  round(
    100.0 * count(*) filter (where not o.readable) / nullif(count(*), 0)
  , 1)                                                as unreadable_pct,
  count(*) filter (where o.failure_reason = 'blocked')            as blocked,
  count(*) filter (where o.failure_reason = 'js_shell')           as js_shell,
  count(*) filter (where o.failure_reason = 'no_structured_data') as no_structured_data,
  count(*) filter (where o.failure_reason = 'not_a_product')      as not_a_product,
  count(*) filter (where o.failure_reason = 'low_confidence')     as low_confidence,
  count(*) filter (where o.failure_reason = 'timeout')            as timeout,
  count(*) filter (where o.failure_reason = 'robots_disallowed')  as robots_disallowed,
  count(*) filter (where o.failure_reason = 'error')              as error,
  sum(o.cost_usd)                                     as cost_usd,
  min(o.observed_at)                                  as first_observed,
  max(o.observed_at)                                  as last_observed
from public.observations o
group by o.cohort, o.run_id;

comment on view public.cohort_readability is
  'Answers "how many of these sites could not be read, and for which distinct reasons" in one query, per cohort per run.';

-- Most recent observation per domain, for the per-domain pages.
create or replace view public.domain_latest as
select distinct on (o.domain)
  o.domain, o.cohort, o.target, o.method, o.readable, o.failure_reason,
  o.confidence, o.http_status, o.robots_allowed, o.observed_at
from public.observations o
order by o.domain, o.observed_at desc;

-- ------------------------------------------------------------------------------- RLS
--
-- The index is published, but only through derived aggregates the app controls. Raw rows
-- are service-role only, matching how every other operational table in this schema is
-- treated. No policies are created, so RLS denies by default to anon and authenticated.

alter table public.observations enable row level security;
alter table public.sweep_runs   enable row level security;

revoke all on public.observations from anon, authenticated;
revoke all on public.sweep_runs   from anon, authenticated;
