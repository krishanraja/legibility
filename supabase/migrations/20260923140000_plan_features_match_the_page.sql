-- The plans table contradicted the front page, in the two places it mattered most.
--
-- free.features said "Card required". The front page says "1,000 trusted reads per month, no
-- card" and llms.txt says "no card". Nothing in the code has ever required a card for the free
-- plan, so the row was wrong and the page was right.
--
-- growth.features said "SLA + Slack". The front page says, in as many words, "There is no
-- enterprise tier, no support channel and no SLA, and we would rather say that here than let
-- you find out later." llms.txt says the same. scripts/check-geo.ts fails the build if either
-- of those claims reappears in llms.txt, precisely because they were removed once already.
--
-- The billing dashboard renders features straight from this table, so a paying customer on the
-- Growth plan was reading a promise of an SLA and a Slack channel that do not exist, on a
-- screen they reached by paying. That is the worst place in the product for that sentence to
-- survive.
--
-- Also corrected here: "calls included" to "trusted reads included". A trusted read is the
-- billing unit (a call that returned a product at confidence 0.7 or above); null and
-- low-confidence reads are free and do not count. Describing the quota as calls overstates
-- what is consumed, which is the wrong direction for a claim to be wrong in.

update public.plans
set features = '["1,000 trusted reads included","No card, hard stop at the quota","Unlimited domain checks"]'::jsonb
where id = 'free';

update public.plans
set features = '["5,000 trusted reads included","$0.01 per read after that","Per-field confidence"]'::jsonb
where id = 'starter';

update public.plans
set features = '["50,000 trusted reads included","$0.005 per read after that","Highest rate limits"]'::jsonb
where id = 'growth';

-- A description of the plan in one line, for the pricing card. It was hardcoded in
-- src/routes/index.tsx beside a comment claiming the values came from this table. They did
-- not: they were literals, and the page and the enforcement could drift without anything
-- noticing. src/data/plans.json is now generated from these rows and CI fails on drift, the
-- same arrangement calibration.json has.
alter table public.plans add column if not exists tagline text;

update public.plans set tagline = '1,000 trusted reads per month, no card' where id = 'free';
update public.plans set tagline = '5,000 trusted reads, $0.01 per read after' where id = 'starter';
update public.plans set tagline = '50,000 trusted reads, $0.005 per read after' where id = 'growth';

comment on column public.plans.tagline is
  'One-line description for the public pricing card. Read into src/data/plans.json by scripts/sync-plans.ts so the page cannot drift from what is enforced.';
