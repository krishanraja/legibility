-- Finish the rename at the last place it still shows: the scheduler.
--
-- The product was called Plinth. It has been Legibility since 2026-08-06, and the rename
-- reached the brand, the domain, the package, the front page and the legibility_id column,
-- but not these two cron jobs. They are the entries an operator reads at 3am in
-- cron.job_run_details while working out what is running against this database, and a job
-- named for a product that no longer exists is exactly the kind of thing that gets assumed
-- to be a leftover from another tenant and unscheduled by mistake.
--
-- That is not hypothetical here. A job named merciless-daily-notifications was left behind
-- by an unrelated app that once shared the old database, sat broken for seven weeks, and had
-- to be removed by migration 20260807120000 once someone worked out whose it was. These two
-- are ours and should say so.
--
-- cron.alter_job cannot rename, so each job is unscheduled and rescheduled with the same
-- schedule and the same command. Jobids change; nothing reads them.

do $rename$
declare
  v_purge_schedule text;
  v_purge_command  text;
  v_ops_schedule   text;
  v_ops_command    text;
begin
  select schedule, command into v_purge_schedule, v_purge_command
  from cron.job where jobname = 'plinth-cache-purge';

  select schedule, command into v_ops_schedule, v_ops_command
  from cron.job where jobname = 'plinth-ops-daily';

  -- Copy the live definitions rather than retyping them, so a schedule that was tuned in the
  -- console since the original migration survives the rename instead of being reverted to
  -- whatever this file happens to assert.
  if v_purge_schedule is not null then
    perform cron.unschedule('plinth-cache-purge');
    perform cron.schedule('legibility-cache-purge', v_purge_schedule, v_purge_command);
  end if;

  if v_ops_schedule is not null then
    perform cron.unschedule('plinth-ops-daily');
    perform cron.schedule('legibility-ops-daily', v_ops_schedule, v_ops_command);
  end if;
end
$rename$;

-- Both jobs must exist under the new names and neither under the old, or the rename left the
-- scheduler in a state where a job this product depends on is simply gone.
do $verify$
begin
  if exists (select 1 from cron.job where jobname like 'plinth-%') then
    raise exception 'rename failed: a plinth-prefixed job remains';
  end if;
  if (select count(*) from cron.job where jobname in ('legibility-cache-purge', 'legibility-ops-daily')) <> 2 then
    raise exception 'rename failed: expected both renamed jobs to exist';
  end if;
end
$verify$;
