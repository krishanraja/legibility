-- A1 (growth-legibility APP-PHASE-1): the internal list and northstar_weekly_keys.
--
-- The North Star's source is "trusted reads by API key, excluding Krish's own keys"
-- (docs/NORTH_STAR.md), and until this migration nothing excluded anybody: with one real
-- account in the app, a single unflagged internal key could be the whole number.
--
-- What this adds:
--   internal_accounts       every internal account, by class. Membership is written at run
--                           time by an admin action on /dashboard/metrics, never by a seed.
--   internal_keys           a class label for a key. A key may only be recorded here when its
--                           account is already internal, so is_internal on the account is
--                           enough for any reader (and every key on an internal account is
--                           internal whether or not it has a row here).
--   read_interface()        api | mcp | testbench, from the metered endpoint.
--   is_trusted_read()       the one definition of a trusted read.
--   northstar_weekly_keys() one row per ISO week and external key with a trusted read.
--   northstar_weekly()      replaced with the same signature and default, now excluding
--                           internal accounts.
--
-- Nothing here names a person, an address or a key: the tables are empty when this runs.

-- =============== THE INTERNAL CLASSES ===============
-- krish          every account Krish uses himself
-- engine         the growth engine's key
-- testbench      the testbench
-- directory_test the account directory reviewers use
-- registry       registry keys
-- ci, demo, smoke

CREATE TABLE IF NOT EXISTS public.internal_accounts (
  account_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  class TEXT NOT NULL CHECK (class IN ('krish', 'engine', 'testbench', 'directory_test', 'registry', 'ci', 'demo', 'smoke')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The admin who added the row: an account id, never an address.
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.internal_accounts IS 'Accounts excluded from the North Star and exported as is_internal. Written at run time by an admin action, never by a seed. Service role only.';

CREATE TABLE IF NOT EXISTS public.internal_keys (
  key_id UUID PRIMARY KEY REFERENCES public.api_keys(id) ON DELETE CASCADE,
  class TEXT NOT NULL CHECK (class IN ('krish', 'engine', 'testbench', 'directory_test', 'registry', 'ci', 'demo', 'smoke')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.internal_keys IS 'A class label for a key on an internal account. Refused for a key whose account is not internal. Service role only.';

-- Service role only. RLS on with no policy, and the default Supabase grants to anon and
-- authenticated revoked, so either role gets "permission denied" rather than an empty list.
ALTER TABLE public.internal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.internal_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.internal_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.internal_accounts TO service_role;
GRANT ALL ON TABLE public.internal_keys TO service_role;

-- An internal key may only live on an internal account.
CREATE OR REPLACE FUNCTION public.internal_keys_require_internal_account()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.api_keys k
    JOIN public.internal_accounts ia ON ia.account_id = k.user_id
    WHERE k.id = NEW.key_id
  ) THEN
    RAISE EXCEPTION 'internal_key_on_external_account'
      USING ERRCODE = 'check_violation',
            HINT = 'Add the key''s account to internal_accounts first.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_internal_keys_require_internal_account ON public.internal_keys;
CREATE TRIGGER trg_internal_keys_require_internal_account
  BEFORE INSERT OR UPDATE ON public.internal_keys
  FOR EACH ROW EXECUTE FUNCTION public.internal_keys_require_internal_account();

-- Taking an account off the list takes its key labels with it, so the invariant above can
-- never be broken from the other side. (Refusing instead would block deleting a user, since
-- the order of the two cascades from auth.users is not guaranteed.)
CREATE OR REPLACE FUNCTION public.internal_accounts_drop_key_labels()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    DELETE FROM public.internal_keys ik
    USING public.api_keys k
    WHERE k.id = ik.key_id AND k.user_id = OLD.account_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_internal_accounts_drop_key_labels ON public.internal_accounts;
CREATE TRIGGER trg_internal_accounts_drop_key_labels
  AFTER DELETE OR UPDATE OF account_id ON public.internal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.internal_accounts_drop_key_labels();

-- =============== WHAT A TRUSTED READ IS ===============
-- The interface a metered row came through. Today every usage_events writer is a REST route
-- under /api/v1/ or the MCP server at /api/mcp. Anything else (a testbench, a dashboard
-- quickstart, a sample read, or a row with no endpoint) is "testbench" and never counts.
CREATE OR REPLACE FUNCTION public.read_interface(_endpoint TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN _endpoint = '/api/mcp' THEN 'mcp'
    WHEN _endpoint LIKE '/api/v1/%' THEN 'api'
    ELSE 'testbench'
  END;
$$;

-- A trusted read: through REST or MCP, a product came back, its confidence is at least the
-- 0.7 gate, and it carries a calibration version.
CREATE OR REPLACE FUNCTION public.is_trusted_read(
  _endpoint TEXT,
  _product_returned BOOLEAN,
  _confidence NUMERIC,
  _calibration_version TEXT
)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT public.read_interface(_endpoint) IN ('api', 'mcp')
     AND COALESCE(_product_returned, false)
     AND COALESCE(_confidence, 0) >= 0.7
     AND COALESCE(btrim(_calibration_version), '') <> '';
$$;

-- =============== THE NUMBER ===============
-- One row per ISO week (Monday 00:00 UTC to the next Monday 00:00 UTC) and external key with
-- at least one trusted read that week, with that key's trusted-read count. The number for a
-- week is the count of its rows. Any date in the week selects it; the default is this week.
-- Weeks are computed in UTC whatever the session time zone is.
CREATE OR REPLACE FUNCTION public.northstar_weekly_keys(
  _week_start DATE DEFAULT (date_trunc('week', (now() AT TIME ZONE 'UTC')))::date
)
RETURNS TABLE(iso_week TEXT, week_start DATE, key_id UUID, trusted_reads INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH w AS (
    SELECT (date_trunc('week', _week_start::timestamp))::date AS monday
  )
  SELECT to_char(w.monday, 'IYYY-"W"IW') AS iso_week,
         w.monday AS week_start,
         ue.api_key_id AS key_id,
         COUNT(*)::integer AS trusted_reads
  FROM w
  JOIN public.usage_events ue
    ON ue.created_at >= (w.monday::timestamp AT TIME ZONE 'UTC')
   AND ue.created_at < ((w.monday + 7)::timestamp AT TIME ZONE 'UTC')
  WHERE ue.api_key_id IS NOT NULL
    AND public.is_trusted_read(ue.endpoint, ue.product_returned, ue.confidence, ue.calibration_version)
    AND NOT EXISTS (SELECT 1 FROM public.internal_accounts ia WHERE ia.account_id = ue.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.internal_keys ik WHERE ik.key_id = ue.api_key_id)
  GROUP BY w.monday, ue.api_key_id
  ORDER BY trusted_reads DESC, key_id;
$$;

-- The existing series, same signature, same default, same columns. The only change is that
-- internal accounts no longer appear in it.
CREATE OR REPLACE FUNCTION public.northstar_weekly(_since TIMESTAMPTZ DEFAULT now() - interval '8 weeks')
RETURNS TABLE(user_id UUID, week DATE, trusted_reads BIGINT, total_calls BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ue.user_id,
         date_trunc('week', ue.created_at)::date AS week,
         COUNT(*) FILTER (WHERE ue.billable) AS trusted_reads,
         COUNT(*) AS total_calls
  FROM public.usage_events ue
  WHERE ue.created_at >= _since
    AND NOT EXISTS (SELECT 1 FROM public.internal_accounts ia WHERE ia.account_id = ue.user_id)
  GROUP BY ue.user_id, date_trunc('week', ue.created_at)
  ORDER BY week DESC, trusted_reads DESC;
$$;

-- Service role only, for every function above.
REVOKE EXECUTE ON FUNCTION public.internal_keys_require_internal_account() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.internal_accounts_drop_key_labels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_interface(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_trusted_read(text, boolean, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.northstar_weekly_keys(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.northstar_weekly(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_interface(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_trusted_read(text, boolean, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.northstar_weekly_keys(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.northstar_weekly(timestamptz) TO service_role;
