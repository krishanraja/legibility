-- Who asked for which read, over time.
--
-- The previous migration linked a person to a check with waitlist.check_id, which holds
-- exactly one value: the most recent. That is a useful CRM fact (the check that converted
-- them) and a useless history, because waitlist.email is UNIQUE, so the second domain someone
-- checks overwrites the first. A person who checks four sites has one row and three lost
-- links.
--
-- This is the many-to-many that was missing. domain_checks stays free of personal data and
-- keeps deduplicating on content, which is correct for an observation. The person lives here,
-- where they are allowed to appear more than once.

create table if not exists public.check_captures (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  check_id     uuid not null references public.domain_checks(id) on delete cascade,
  captured_at  timestamptz not null default now()
);

comment on table public.check_captures is
  'One row per person asking for one read. The join between a person and the checks they requested, kept out of domain_checks so that table holds no personal data.';

-- Asking twice for the same read is one capture, not two. Same reasoning as the dedupe index
-- on domain_checks: idempotency stated as a constraint rather than trusted to the caller.
create unique index if not exists check_captures_dedupe
  on public.check_captures (email, check_id);

-- The dashboard query: everything this person asked for, newest first.
create index if not exists check_captures_email_captured
  on public.check_captures (email, captured_at desc);

-- ON DELETE CASCADE above, unlike waitlist.check_id which sets null. The difference is
-- deliberate: honouring a takedown should remove the link to a deleted observation, while the
-- person who asked about it stays on the waitlist. A dangling capture row pointing at nothing
-- would be a record of a read that no longer exists.

alter table public.check_captures enable row level security;
revoke all on public.check_captures from anon, authenticated;

comment on column public.check_captures.email is
  'Matched against the signed-in user''s email to show them their own checks. Not a foreign key to auth.users: a capture happens before, and usually without, an account.';
