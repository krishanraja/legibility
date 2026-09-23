-- Give observations the evidence string, which it was computing and discarding.
--
-- classify() returns a verdict and a detail: "1 JSON-LD block", "549KB of HTML, no JSON-LD,
-- 0 og: tags", "HTTP 403". The sweep built that string, printed it to the console and threw
-- it away, because observations had nowhere to put it. domain_checks, added later for the
-- visitor checker, has a detail column for exactly this.
--
-- It matters more here than there. The index publishes a verdict about a named company, and
-- a verdict with its evidence attached is a finding, while a verdict on its own is an
-- assertion. "bestbuy.com: no structured data" invites an argument. "bestbuy.com: 549KB of
-- HTML, no JSON-LD, 0 og: tags" ends one.
--
-- Nullable, because rows written before this column existed cannot have it, and backfilling
-- a plausible string would be inventing evidence for an observation nobody made.

alter table public.observations add column if not exists detail text;

comment on column public.observations.detail is
  'The evidence behind the verdict, as produced by classify(). Null for rows recorded before the column existed; never reconstructed.';
