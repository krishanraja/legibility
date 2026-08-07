-- Remove the `merciless-daily-notifications` scheduled job.
--
-- This job does not belong to this product. It was left behind by an unrelated
-- application ("merciless") that once shared this database. It posts to a
-- `send-notifications` edge function that this project does not deploy.
--
-- It has also been broken for seven weeks. Measured from cron.job_run_details
-- before removal:
--
--   succeeded: 18 runs, 2026-05-31 to 2026-06-17
--   failed:    51 runs, 2026-06-18 to 2026-08-07, every one with
--              `ERROR: schema "net" does not exist`
--
-- The break lines up with pg_net no longer being installed, so the job has had
-- no chance of firing successfully since. Every one of those 51 rows is noise in
-- the job history that has to be read past when diagnosing the two jobs that do
-- belong here (plinth-cache-purge, plinth-ops-daily).
--
-- Unscheduling through a migration rather than a console action so the removal
-- is versioned and reproducible against a fresh database.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'merciless-daily-notifications') then
    perform cron.unschedule('merciless-daily-notifications');
  end if;
end
$$;
