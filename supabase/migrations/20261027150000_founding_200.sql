-- A3 (growth-legibility APP-PHASE-1): the run-first Founding 200 page.
--
-- A builder tries Legibility on their own product in two minutes, with no signup: the result
-- shows inline, and only then are they asked for an email, which gets a fixed-template
-- verification link and nothing else. After verification they get a key and the report.
--
-- What this adds (all service role only):
--   founding_runs        one row per test run, for the limits: per hashed IP and per product
--                        domain each UTC day, a daily run count and a daily cost ceiling. In the
--                        database, so a restart or a new serverless instance resets nothing.
--   founding_entries     what the builder typed (the input, what they are building, REST or
--                        MCP, which stores) and the run's result, linked to an account once they
--                        sign up. The input is private: the export never carries it.
--   founding_page_views  one row per hashed IP per UTC day, so beta_page_viewed counts
--                        visitors a day rather than reloads.
--   claim_founding_run(), complete_founding_run(), record_founding_view(),
--   claim_founding_entry() and a trigger that links an entry at sign-up.
--   growth_export_rows() replaced: accounts now carry use_case and relevant_context.
--
-- Never stored: an IP address (only an HMAC of it), an email address in these tables, or a key.

CREATE TABLE IF NOT EXISTS public.founding_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  ip_hash TEXT NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  domain TEXT CHECK (domain ~ '^[a-z0-9.-]{1,253}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0)
);
CREATE INDEX IF NOT EXISTS founding_runs_day_idx ON public.founding_runs (day, ip_hash);
CREATE INDEX IF NOT EXISTS founding_runs_day_domain_idx ON public.founding_runs (day, domain);

CREATE TABLE IF NOT EXISTS public.founding_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id UUID REFERENCES public.founding_runs(id) ON DELETE SET NULL,
  account_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ,
  use_case TEXT NOT NULL DEFAULT '' CHECK (length(use_case) <= 2000),
  interface TEXT NOT NULL CHECK (interface IN ('rest', 'mcp')),
  stores TEXT NOT NULL DEFAULT '' CHECK (length(stores) <= 500),
  input_kind TEXT NOT NULL CHECK (input_kind IN ('url', 'gtin')),
  input TEXT NOT NULL CHECK (length(input) BETWEEN 1 AND 2048),
  -- A real input is the builder's own: not the demo barcode every sample uses.
  real_input BOOLEAN NOT NULL,
  trusted BOOLEAN NOT NULL,
  result JSONB,
  -- When the builder asked for a key by email: founding_200_submitted is recorded once.
  submitted_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source ~ '^[a-z0-9][a-z0-9._:-]{0,79}$')
);
COMMENT ON TABLE public.founding_entries IS 'Founding 200 entries: what the builder typed and the run result, linked to an account at sign-up. The input is never exported. Service role only.';
CREATE INDEX IF NOT EXISTS founding_entries_account_idx ON public.founding_entries (account_id);

CREATE TABLE IF NOT EXISTS public.founding_page_views (
  ip_hash TEXT NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  day DATE NOT NULL,
  PRIMARY KEY (ip_hash, day)
);

ALTER TABLE public.founding_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founding_page_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.founding_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.founding_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.founding_page_views FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.founding_runs TO service_role;
GRANT ALL ON TABLE public.founding_entries TO service_role;
GRANT ALL ON TABLE public.founding_page_views TO service_role;

-- =============== LIMITS ===============
-- Check every limit and record the run in one step, under a lock, so two runs at once cannot
-- both slip under a limit. The numbers come from the app (src/lib/api/founding.ts) so they are
-- reviewed in code; the counting lives here. Pending runs count towards the limits.
CREATE OR REPLACE FUNCTION public.claim_founding_run(
  _ip_hash TEXT,
  _domain TEXT,
  _per_ip INTEGER,
  _per_domain INTEGER,
  _per_day INTEGER,
  _cost_ceiling_usd NUMERIC
)
RETURNS TABLE(allowed BOOLEAN, reason TEXT, run_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day DATE := (now() AT TIME ZONE 'UTC')::date;
  v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('founding_runs'));

  IF (SELECT COALESCE(SUM(r.cost_usd), 0) FROM public.founding_runs r WHERE r.day = v_day) >= _cost_ceiling_usd THEN
    RETURN QUERY SELECT false, 'cost_ceiling'::text, NULL::uuid; RETURN;
  END IF;
  IF (SELECT COUNT(*) FROM public.founding_runs r WHERE r.day = v_day) >= _per_day THEN
    RETURN QUERY SELECT false, 'daily_runs'::text, NULL::uuid; RETURN;
  END IF;
  IF (SELECT COUNT(*) FROM public.founding_runs r WHERE r.day = v_day AND r.ip_hash = _ip_hash) >= _per_ip THEN
    RETURN QUERY SELECT false, 'ip_limit'::text, NULL::uuid; RETURN;
  END IF;
  IF _domain IS NOT NULL AND (
    SELECT COUNT(*) FROM public.founding_runs r WHERE r.day = v_day AND r.domain = _domain
  ) >= _per_domain THEN
    RETURN QUERY SELECT false, 'domain_limit'::text, NULL::uuid; RETURN;
  END IF;

  INSERT INTO public.founding_runs (day, ip_hash, domain)
  VALUES (v_day, _ip_hash, _domain)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT true, 'ok'::text, v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_founding_run(_run_id UUID, _status TEXT, _cost_usd NUMERIC)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.founding_runs
     SET status = _status, cost_usd = GREATEST(COALESCE(_cost_usd, 0), 0)
   WHERE id = _run_id AND status = 'pending';
$$;

-- One beta_page_viewed per hashed IP per UTC day. Returns whether this view was the first.
CREATE OR REPLACE FUNCTION public.record_founding_view(_ip_hash TEXT, _source TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.founding_page_views (ip_hash, day)
  VALUES (_ip_hash, (now() AT TIME ZONE 'UTC')::date)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    INSERT INTO public.growth_events (type, account_id, source)
    VALUES ('beta_page_viewed', NULL,
            CASE WHEN _source ~ '^[a-z0-9][a-z0-9._:-]{0,79}$' THEN _source ELSE 'direct' END);
  END IF;
  RETURN v_count > 0;
END;
$$;

-- =============== LINKING AN ENTRY TO ITS ACCOUNT ===============
-- An entry is linked once, to one account, within seven days of the run.
CREATE OR REPLACE FUNCTION public.claim_founding_entry(_entry_id UUID, _account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.founding_entries
     SET account_id = _account_id, claimed_at = now()
   WHERE id = _entry_id AND account_id IS NULL AND created_at > now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0 OR EXISTS (
    SELECT 1 FROM public.founding_entries WHERE id = _entry_id AND account_id = _account_id);
END;
$$;

-- A new account made from the page carries the entry id as sign-up metadata, so the entry is
-- linked the moment the account exists, verified or not. Never blocks a sign-up.
CREATE OR REPLACE FUNCTION public.link_founding_entry()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry TEXT := NEW.raw_user_meta_data->>'founding_entry';
BEGIN
  IF v_entry ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    BEGIN
      PERFORM public.claim_founding_entry(v_entry::uuid, NEW.id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'founding entry not linked (%)', SQLSTATE;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_founding ON auth.users;
CREATE TRIGGER on_auth_user_created_founding
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_founding_entry();

-- =============== THE EXPORT, WITH QUALIFICATION ===============
-- Same as 20261027140000 plus two account fields: use_case (from the latest linked entry) and
-- relevant_context (a linked entry ran on a real input). The route scrubs use_case of anything
-- that looks like an address, a URL, an IP or a barcode before it leaves.
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
        'first_key_touch', (SELECT public.export_touch(t) FROM public.attribution_touches t
                             WHERE t.key_id = a.first_key_id AND t.kind = 'key_creation')
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

REVOKE EXECUTE ON FUNCTION public.claim_founding_run(text, text, integer, integer, integer, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_founding_run(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_founding_view(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_founding_entry(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_founding_entry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.growth_export_rows(timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founding_run(text, text, integer, integer, integer, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_founding_run(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_founding_view(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_founding_entry(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.growth_export_rows(timestamptz, timestamptz, timestamptz) TO service_role;
