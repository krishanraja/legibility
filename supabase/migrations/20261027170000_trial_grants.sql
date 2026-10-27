-- A8 (growth-legibility APP-PHASE-1): the 30-day trial.
--
-- The offer (Ruling, Krish, 2026-10-27) is a 30-day free trial in exchange for feedback.
-- Until now the honest version was the Free plan: 1,000 trusted reads a month, no end date.
-- This makes a real trial, granted by hand and enforced, and never worse than Free.
--
-- What this adds:
--   trial_grants        one row per account, ever: an allowance of trusted reads counted from
--                       the grant (the clock starts at the grant), a hard stop, its own cost
--                       fuse sized from the allowance, at most 30 days, an optional invitation
--                       id so a hand-granted key still traces (A2), and who granted it.
--   grant_trial()       the only way a grant is made, service role only: the admin's click on
--                       /dashboard/waitlist (Trials) is the provisioning approval.
--   end_trial()         ends a live grant early.
--   trial_cost_per_call()  the read-only measurement the fuse is sized from.
--   entitlement_check() replaced, same signature: a paid subscription wins; otherwise a live
--                       grant serves reads until its allowance or fuse; otherwise, and whenever
--                       the grant would refuse, the Free plan decides exactly as before. A trial
--                       is therefore never worse than Free, and after day 30 or exhaustion the
--                       account is simply on Free.
--
-- What this never touches: Stripe, subscriptions, checkout, rate_check, plans.

CREATE TABLE IF NOT EXISTS public.trial_grants (
  account_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  allowance INTEGER NOT NULL CHECK (allowance > 0 AND allowance <= 1000000),
  cost_fuse_cents NUMERIC(12, 2) NOT NULL CHECK (cost_fuse_cents > 0),
  invitation_id TEXT CHECK (invitation_id IS NOT DISTINCT FROM public.attribution_invitation(invitation_id)),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ended_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '30 days')
);
COMMENT ON TABLE public.trial_grants IS 'At most one 30-day trial per account, granted by an admin. Never touches Stripe or subscriptions. Service role only.';

ALTER TABLE public.trial_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trial_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.trial_grants TO service_role;

-- The grant. Refuses more than 30 days, a second grant for the same account, and a fuse or an
-- allowance that is not positive. The clock starts now.
CREATE OR REPLACE FUNCTION public.grant_trial(
  _account_id UUID,
  _allowance INTEGER,
  _days INTEGER,
  _cost_fuse_cents NUMERIC,
  _invitation_id TEXT,
  _granted_by UUID
)
RETURNS TABLE(starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _days IS NULL OR _days < 1 OR _days > 30 THEN
    RAISE EXCEPTION 'trial_too_long' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trial_grants g WHERE g.account_id = _account_id) THEN
    RAISE EXCEPTION 'trial_already_granted' USING ERRCODE = 'unique_violation';
  END IF;
  IF _invitation_id IS NOT NULL AND public.attribution_invitation(_invitation_id) IS NULL THEN
    RAISE EXCEPTION 'invalid_invitation_id' USING ERRCODE = 'check_violation';
  END IF;
  RETURN QUERY
  INSERT INTO public.trial_grants
    (account_id, starts_at, ends_at, allowance, cost_fuse_cents, invitation_id, granted_by)
  VALUES (_account_id, now(), now() + make_interval(days => _days), _allowance,
          _cost_fuse_cents, _invitation_id, _granted_by)
  RETURNING trial_grants.starts_at, trial_grants.ends_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_trial(_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.trial_grants SET ended_at = now()
   WHERE account_id = _account_id AND ended_at IS NULL AND ends_at > now()
  RETURNING true;
$$;

-- Read-only: what a metered call has cost over the last 30 days (REST and MCP), so the fuse is
-- sized from a measurement rather than a guess.
CREATE OR REPLACE FUNCTION public.trial_cost_per_call()
RETURNS TABLE(calls BIGINT, avg_usd NUMERIC, p95_usd NUMERIC, max_usd NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*),
         ROUND(AVG(ue.cost_usd), 6),
         ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY ue.cost_usd))::numeric, 6),
         MAX(ue.cost_usd)
  FROM public.usage_events ue
  WHERE ue.created_at >= now() - interval '30 days'
    AND public.read_interface(ue.endpoint) IN ('api', 'mcp');
$$;

-- =============== ENTITLEMENT ===============
-- Same signature and columns as 20260706130000. The Free branch is that migration's logic,
-- unchanged; the trial branch sits in front of it and falls back to it.
CREATE OR REPLACE FUNCTION public.entitlement_check(_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT,
  plan_id TEXT,
  included_calls INT,
  used_billable BIGINT,
  cost_spent_cents NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_included INT;
  v_used BIGINT;
  v_cost NUMERIC;
  period_start TIMESTAMPTZ := date_trunc('month', now());
  free_cost_fuse_cents CONSTANT NUMERIC := 3000;
  g public.trial_grants%ROWTYPE;
  t_used BIGINT;
  t_cost NUMERIC;
  free_allowed BOOLEAN;
  free_reason TEXT;
BEGIN
  SELECT p.id, p.included_calls
    INTO v_plan, v_included
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = _user_id AND s.status IN ('active', 'trialing')
  LIMIT 1;

  IF v_plan IS NULL THEN
    SELECT p.id, p.included_calls INTO v_plan, v_included FROM public.plans p WHERE p.id = 'free';
  END IF;
  IF v_included IS NULL THEN v_included := 1000; END IF;

  SELECT COUNT(*) FILTER (WHERE billable),
         COALESCE(SUM(cost_usd) * 100, 0)
    INTO v_used, v_cost
  FROM public.usage_events
  WHERE user_id = _user_id AND created_at >= period_start;

  -- A real (non-free) subscription wins, exactly as before: paid tiers are never hard-blocked.
  IF v_plan <> 'free' THEN
    RETURN QUERY SELECT true, 'ok', v_plan, v_included, v_used, v_cost; RETURN;
  END IF;

  -- What the Free plan says, unchanged.
  IF v_used >= v_included THEN
    free_allowed := false; free_reason := 'quota_exceeded';
  ELSIF v_cost >= free_cost_fuse_cents THEN
    free_allowed := false; free_reason := 'cost_fuse';
  ELSE
    free_allowed := true; free_reason := 'ok';
  END IF;

  -- A live grant: started, not past its end, not ended early.
  SELECT * INTO g FROM public.trial_grants tg
   WHERE tg.account_id = _user_id AND tg.starts_at <= now() AND tg.ends_at > now()
     AND tg.ended_at IS NULL;

  IF FOUND THEN
    SELECT COUNT(*) FILTER (WHERE billable), COALESCE(SUM(cost_usd) * 100, 0)
      INTO t_used, t_cost
    FROM public.usage_events
    WHERE user_id = _user_id AND created_at >= g.starts_at;

    IF t_used < g.allowance AND t_cost < g.cost_fuse_cents THEN
      RETURN QUERY SELECT true, 'ok', 'trial'::text, g.allowance, t_used, t_cost; RETURN;
    END IF;
    -- The trial is used up. Never worse than Free: Free decides, and only if Free refuses too
    -- does the answer say the trial is used up (and that nothing was charged).
    IF free_allowed THEN
      RETURN QUERY SELECT true, 'ok', v_plan, v_included, v_used, v_cost; RETURN;
    END IF;
    RETURN QUERY SELECT false, 'trial_used_up', 'trial'::text, g.allowance, t_used, t_cost; RETURN;
  END IF;

  RETURN QUERY SELECT free_allowed, free_reason, v_plan, v_included, v_used, v_cost;
END;
$$;

-- =============== A HAND-GRANTED KEY STILL TRACES ===============
-- The export's first_key touch takes the grant's invitation id when the key's own touch has
-- none (A2, A4). Same as 20261027150000 otherwise.
CREATE OR REPLACE FUNCTION public.export_first_key_touch(_key_id UUID, _account_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object(
    'invitation_id', COALESCE(t.invitation_id,
                              (SELECT g.invitation_id FROM public.trial_grants g WHERE g.account_id = _account_id)),
    'utm_source', t.utm_source,
    'utm_medium', t.utm_medium,
    'utm_campaign', t.utm_campaign,
    'referrer_host', t.referrer_host,
    'directory', t.directory,
    'client', t.client,
    'touched_at', public.export_instant(t.occurred_at)
  ) END
  FROM (SELECT NULL::uuid AS dummy) d
  LEFT JOIN public.attribution_touches t ON t.key_id = _key_id AND t.kind = 'key_creation';
$$;

CREATE OR REPLACE FUNCTION public.growth_export_rows(
  _start TIMESTAMPTZ,
  _end TIMESTAMPTZ,
  _captured_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH accts AS (
    SELECT u.id, u.created_at, u.email_confirmed_at,
           (SELECT k.id FROM public.api_keys k
             WHERE k.user_id = u.id AND k.created_at <= _captured_at
             ORDER BY k.created_at, k.id LIMIT 1) AS first_key_id,
           (SELECT MIN(k.created_at) FROM public.api_keys k
             WHERE k.user_id = u.id AND k.created_at <= _captured_at) AS first_key_at
    FROM auth.users u
    WHERE u.created_at <= _captured_at
  )
  SELECT jsonb_build_object(
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'email_verified', a.email_confirmed_at IS NOT NULL AND a.email_confirmed_at <= _captured_at,
        'is_internal', EXISTS (SELECT 1 FROM public.internal_accounts ia WHERE ia.account_id = a.id),
        'enrolled_at', public.export_instant(a.created_at),
        'api_key_created_at', public.export_instant(a.first_key_at),
        'acquisition_source', public.account_acquisition_source(a.id),
        'use_case', COALESCE((SELECT fe.use_case FROM public.founding_entries fe
                               WHERE fe.account_id = a.id AND fe.claimed_at <= _captured_at
                               ORDER BY fe.claimed_at DESC, fe.id LIMIT 1), ''),
        'relevant_context', EXISTS (SELECT 1 FROM public.founding_entries fe
                                     WHERE fe.account_id = a.id AND fe.claimed_at <= _captured_at
                                       AND fe.real_input),
        'enrolment_touch', (SELECT public.export_touch(t) FROM public.attribution_touches t
                             WHERE t.account_id = a.id AND t.kind = 'enrolment'),
        'first_key_touch', public.export_first_key_touch(a.first_key_id, a.id)
      ) ORDER BY a.created_at, a.id)
      FROM accts a), '[]'::jsonb),
    'reads', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ue.id,
        'account_id', ue.user_id,
        'key_id', ue.api_key_id,
        'occurred_at', public.export_instant(ue.created_at),
        'utc_date', to_char(ue.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
        'interface', public.read_interface(ue.endpoint),
        'product_present', COALESCE(ue.product_returned, false),
        'confidence', ue.confidence,
        'calibration_version', ue.calibration_version,
        'cost_usd', ue.cost_usd,
        'method', ue.method,
        'status', ue.status
      ) ORDER BY ue.created_at, ue.id)
      FROM public.usage_events ue
      WHERE ue.created_at >= _start AND ue.created_at < _end), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ge.id,
        'type', ge.type,
        'account_id', ge.account_id,
        'occurred_at', public.export_instant(ge.occurred_at),
        'source', ge.source
      ) ORDER BY ge.occurred_at, ge.id)
      FROM public.growth_events ge
      WHERE ge.occurred_at >= _start AND ge.occurred_at < _end), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.grant_trial(uuid, integer, integer, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.end_trial(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trial_cost_per_call() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entitlement_check(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.export_first_key_touch(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.growth_export_rows(timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_trial(uuid, integer, integer, numeric, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_trial(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.trial_cost_per_call() TO service_role;
GRANT EXECUTE ON FUNCTION public.entitlement_check(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.growth_export_rows(timestamptz, timestamptz, timestamptz) TO service_role;
