-- Address two Supabase linter findings on public.outcome_reports.
--
-- 1) auth_rls_initplan (WARN): both policies call auth.uid() unwrapped, so Postgres
--    re-evaluates it once per row instead of once per statement. Wrapping it in a
--    scalar subquery lets the planner hoist it to an InitPlan. Same semantics, and
--    the difference shows up as soon as a user has more than a handful of rows.
--
-- 2) unindexed_foreign_keys (INFO): outcome_reports_user_id_fkey has no covering
--    index, so both the RLS predicate and any cascade have to seq-scan.
--
-- Behaviour is unchanged. A user still sees and inserts only their own rows.

DROP POLICY IF EXISTS outcome_reports_own_select ON public.outcome_reports;
DROP POLICY IF EXISTS outcome_reports_own_insert ON public.outcome_reports;

CREATE POLICY outcome_reports_own_select
  ON public.outcome_reports
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY outcome_reports_own_insert
  ON public.outcome_reports
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS outcome_reports_user_id_idx
  ON public.outcome_reports (user_id);
