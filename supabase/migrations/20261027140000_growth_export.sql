-- A4 (growth-legibility APP-PHASE-1): the row-level export the growth engine reads.
--
-- Every engine report has been held with source_snapshot_missing because the app had no
-- export. The export is row-level, not aggregate, so the engine's own guards still apply
-- (internal exclusion, testbench exclusion, the 0.7 gate, mature seven-day returns, no
-- credit to a key made before its touch).
--
-- The database hands back raw rows; the route (src/routes/api/internal/growth/export.ts)
-- replaces every database id with an opaque HMAC id and shapes the engine's contract. What
-- leaves these functions never includes an email address, a name, an IP, a product input,
-- a key value or prefix, a wallet address, a User-Agent or a Stripe id.
--
-- What this adds:
--   usage_events.method      the extraction method the worker reports, stamped from now on.
--   export_instant()         a UTC instant at millisecond precision, the engine's format.
--   growth_export_counts()   section sizes for a window, read first (the size limit and the
--                            reads reconciliation).
--   growth_export_rows()     the rows themselves, as one JSON value (so no API row cap can
--                            silently truncate a section).

ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS method TEXT;
COMMENT ON COLUMN public.usage_events.method IS 'Extraction method the worker reported (jsonld, shopify, barcode, ...), a short plain token or null. Null before A4.';

-- Postgres keeps microseconds and the engine refuses them: truncate, never round, so an
-- instant can never move past the capture it belongs to.
CREATE OR REPLACE FUNCTION public.export_instant(_ts TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT to_char(date_trunc('milliseconds', _ts AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

CREATE OR REPLACE FUNCTION public.growth_export_counts(
  _start TIMESTAMPTZ,
  _end TIMESTAMPTZ,
  _captured_at TIMESTAMPTZ
)
RETURNS TABLE(accounts BIGINT, reads BIGINT, events BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM auth.users u WHERE u.created_at <= _captured_at),
    (SELECT COUNT(*) FROM public.usage_events ue WHERE ue.created_at >= _start AND ue.created_at < _end),
    (SELECT COUNT(*) FROM public.growth_events ge WHERE ge.occurred_at >= _start AND ge.occurred_at < _end);
$$;

-- One touch as the export's attribution object (without the client for an enrolment touch).
CREATE OR REPLACE FUNCTION public.export_touch(_t public.attribution_touches)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT CASE WHEN _t.id IS NULL THEN NULL ELSE jsonb_build_object(
    'invitation_id', _t.invitation_id,
    'utm_source', _t.utm_source,
    'utm_medium', _t.utm_medium,
    'utm_campaign', _t.utm_campaign,
    'referrer_host', _t.referrer_host,
    'directory', _t.directory,
    'client', _t.client,
    'touched_at', public.export_instant(_t.occurred_at)
  ) END;
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

REVOKE EXECUTE ON FUNCTION public.export_instant(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.export_touch(public.attribution_touches) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.growth_export_counts(timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.growth_export_rows(timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.growth_export_counts(timestamptz, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.growth_export_rows(timestamptz, timestamptz, timestamptz) TO service_role;
