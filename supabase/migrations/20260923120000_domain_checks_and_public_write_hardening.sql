-- Two things, both about the front door.
--
-- 1. The visitor check becomes a record.
--
-- /api/check computed a verdict, rendered it, and threw it away. That made the three things
-- the result card promises (a field-by-field breakdown, history over time, comparison with a
-- category) not merely unbuilt but impossible: there was no row to build them from. The
-- front page says "Nothing is stored against your domain unless you ask us to", so the row
-- is written at capture time, when the visitor hands over an email and asks. The claim stays
-- exactly true and needs no rewording.
--
-- 2. The public write path stops being open.
--
-- waitlist and takedown_requests both granted INSERT to anon under WITH CHECK (true). Anyone
-- could script unlimited rows straight at PostgREST, with no rate limit, no validation and
-- no size cap, while /api/check next door was carefully guarded. Both writes now go through
-- a server route holding the service role, so the guards live in one place and the tables are
-- not reachable from a browser at all.

-- ------------------------------------------------------------------ the observation table
--
-- Modelled on public.observations, and deliberately separate from it. observations is the
-- published index over a fixed cohort; this is visitor-driven and its targets are chosen by
-- whoever types into the box. Mixing them would let anyone move a published number by
-- checking a domain repeatedly, which is the one thing an index cannot survive.
--
-- No email and no user id on this table. It records what was read, not who asked. The person
-- lives in waitlist, linked by check_id below, which keeps this table free of buyer PII in
-- line with the rest of the schema and makes the dedupe index correct: an observation is
-- deduplicated, a person is not.

create table if not exists public.domain_checks (
  id              uuid primary key default gen_random_uuid(),
  captured_at     timestamptz not null default now(),

  -- When the read actually happened, as opposed to when it was captured. These differ by
  -- however long the visitor took to decide, and conflating them would put a timestamp on
  -- the history chart that no request corresponds to.
  checked_at      timestamptz not null,

  host            text not null,

  -- 'none' rather than NULL, for the same reason observations.method is: NULLs are distinct
  -- in Postgres, so a nullable column in the unique index below would let identical
  -- failures insert forever.
  method          text not null default 'none',

  readable        boolean not null,
  failure_reason  text
    check (failure_reason is null or failure_reason in (
      'blocked',
      'js_shell',
      'no_structured_data',
      'not_a_product',
      'low_confidence',
      'timeout',
      'robots_disallowed',
      'error'
    )),

  http_status     integer,
  detail          text,

  -- sha256 over the canonical signed verdict, the same bytes /api/check put its HMAC over.
  -- Re-submitting a verdict already stored is a no-op by construction rather than by
  -- convention, which matters because the capture form can be submitted twice.
  envelope_hash   text not null,

  -- A readable row must carry no failure reason, and an unreadable row must carry one, so
  -- the table cannot hold a row that answers the product's central question with a shrug.
  constraint domain_checks_reason_matches_outcome check (
    (readable and failure_reason is null) or (not readable and failure_reason is not null)
  )
);

comment on table public.domain_checks is
  'Visitor-initiated readability checks, stored only once the visitor asked us to by giving an email. Separate from public.observations so a visitor cannot move a published index number. Holds no personal data; the person is in public.waitlist via check_id.';

create unique index if not exists domain_checks_dedupe
  on public.domain_checks (host, envelope_hash);

-- The history query: every check for one host, newest first.
create index if not exists domain_checks_host_checked
  on public.domain_checks (host, checked_at desc);

create index if not exists domain_checks_failure_reason
  on public.domain_checks (failure_reason, checked_at desc) where not readable;

-- Service role only, matching observations. Raw rows are never reachable from a browser.
alter table public.domain_checks enable row level security;
revoke all on public.domain_checks from anon, authenticated;

-- ------------------------------------------------------- link the person to the observation
--
-- Nullable: a waitlist row can exist without a check behind it if capture is ever reached
-- from another surface. ON DELETE SET NULL rather than CASCADE, because honouring a takedown
-- on a domain must not silently delete the people who asked about it.

alter table public.waitlist
  add column if not exists check_id uuid references public.domain_checks(id) on delete set null;

create index if not exists waitlist_check_id on public.waitlist (check_id);

-- ------------------------------------------------------------- close the public write path
--
-- Both tables keep RLS enabled and keep their admin policies. What goes is anon's ability to
-- write to them directly. The service role bypasses RLS, so /api/capture and /api/takedown
-- are unaffected; a browser hitting PostgREST is refused.

drop policy if exists "waitlist_insert_public" on public.waitlist;
revoke insert on public.waitlist from anon;

drop policy if exists "Anyone can file takedown" on public.takedown_requests;
revoke insert on public.takedown_requests from anon, authenticated;

-- authenticated kept INSERT on waitlist from the original grant. Nothing writes it that way
-- now, and leaving it would be a second unguarded door that happens to need a login first.
revoke insert on public.waitlist from authenticated;

comment on column public.waitlist.check_id is
  'The domain_checks row this person was looking at when they asked. Null when capture came from a surface with no check behind it.';
