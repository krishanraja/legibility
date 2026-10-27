-- A2 (growth-legibility APP-PHASE-1): attribution capture.
--
-- The growth engine's line for March 2027 is to trace every production agent to the channel
-- that earned it, and Krish's ruling of 27 October needs an introduced engineer's first read
-- to trace back to the commercial leader's invitation. A touch that is not captured can never
-- be credited later, so this has to be live before the first invitation goes out.
--
-- What this adds (all service role only):
--   attribution_touches     one row per touch: an account's enrolment touch (from sign-up
--                           metadata, written by a trigger on auth.users) and a key's touch
--                           (written when the key is created), plus the first client that
--                           used the key. Every field is validated here again.
--   growth_events           server-side growth events (email_verified, key_created), each
--                           with the account's channel label. The export (A4) reads these.
--   attribution_channel()   the channel label, by the brief's order.
--   account_acquisition_source()  internal, or the enrolment touch's label, or direct.
--   record_key_creation()   the key's touch and its key_created event, once.
--   record_key_client()     the first client that used a key, once.
--   record_email_verified() the email_verified event, once per account.
--
-- Never stored: an email address, an IP address, a name, a product input, a key, a full
-- User-Agent, or a referrer's path or query.

-- =============== FIELD RULES ===============
-- An IPv4 address anywhere in a value is refused: never stored, even as a referrer's host.
CREATE OR REPLACE FUNCTION public.attribution_has_ip(_value TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT COALESCE(_value ~ '(^|[^0-9])[0-9]{1,3}(\.[0-9]{1,3}){3}($|[^0-9])', false);
$$;

CREATE OR REPLACE FUNCTION public.attribution_utm(_value TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(btrim(_value)) ~ '^[a-z0-9][a-z0-9._:-]{0,99}$'
     AND NOT public.attribution_has_ip(_value) THEN lower(btrim(_value))
  END;
$$;

CREATE OR REPLACE FUNCTION public.attribution_host(_value TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(_value) ~ '^[a-z0-9.-]{1,253}$' AND NOT public.attribution_has_ip(_value)
      THEN lower(_value)
  END;
$$;

CREATE OR REPLACE FUNCTION public.attribution_invitation(_value TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN length(_value) <= 120 AND _value ~ '^legibility:[A-Za-z0-9:._-]+$' THEN _value
  END;
$$;

-- The brief's order. "internal" is not a touch property: account_acquisition_source decides it.
CREATE OR REPLACE FUNCTION public.attribution_channel(
  _invitation_id TEXT,
  _utm_source TEXT,
  _utm_medium TEXT,
  _directory TEXT,
  _referrer_host TEXT
)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT left(CASE
    WHEN _invitation_id IS NOT NULL AND _utm_medium = 'introduction' THEN 'introduction'
    WHEN _invitation_id IS NOT NULL THEN 'invitation'
    WHEN _directory IS NOT NULL THEN 'directory:' || _directory
    WHEN _utm_source IS NOT NULL THEN 'utm:' || _utm_source
    WHEN _referrer_host IS NOT NULL THEN 'referrer:' || _referrer_host
    ELSE 'direct'
  END, 80);
$$;

-- =============== TOUCHES ===============
CREATE TABLE IF NOT EXISTS public.attribution_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('landing', 'enrolment', 'key_creation')),
  invitation_id TEXT CHECK (invitation_id IS NOT DISTINCT FROM public.attribution_invitation(invitation_id)),
  utm_source TEXT CHECK (utm_source IS NOT DISTINCT FROM public.attribution_utm(utm_source)),
  utm_medium TEXT CHECK (utm_medium IS NOT DISTINCT FROM public.attribution_utm(utm_medium)),
  utm_campaign TEXT CHECK (utm_campaign IS NOT DISTINCT FROM public.attribution_utm(utm_campaign)),
  referrer_host TEXT CHECK (referrer_host IS NOT DISTINCT FROM public.attribution_host(referrer_host)),
  directory TEXT CHECK (directory IN ('mcp_registry', 'claude_directory', 'smithery', 'glama', 'pulsemcp')),
  client TEXT CHECK (client ~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,99}$'),
  channel TEXT GENERATED ALWAYS AS (
    public.attribution_channel(invitation_id, utm_source, utm_medium, directory, referrer_host)
  ) STORED,
  -- When the builder arrived through this touch (the landing time it carries). For a key
  -- created with no touch at all, the key's creation time.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'key_creation') = (key_id IS NOT NULL)),
  CHECK (kind = 'landing' OR account_id IS NOT NULL)
);
COMMENT ON TABLE public.attribution_touches IS 'Where a builder came from: one enrolment touch per account and one touch per key. No address, IP, name, product input, key, full User-Agent or referrer path. Service role only.';

CREATE UNIQUE INDEX IF NOT EXISTS attribution_touches_one_enrolment
  ON public.attribution_touches (account_id) WHERE kind = 'enrolment';
CREATE UNIQUE INDEX IF NOT EXISTS attribution_touches_one_per_key
  ON public.attribution_touches (key_id) WHERE kind = 'key_creation';
CREATE INDEX IF NOT EXISTS attribution_touches_account_idx
  ON public.attribution_touches (account_id);

-- =============== SERVER-SIDE GROWTH EVENTS ===============
CREATE TABLE IF NOT EXISTS public.growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type ~ '^[a-z0-9_]{1,64}$'),
  account_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source ~ '^[a-z0-9][a-z0-9._:-]{0,79}$'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.growth_events IS 'Server-side growth events for the export (A4). Never an IP, User-Agent, address or product input. Service role only.';
CREATE UNIQUE INDEX IF NOT EXISTS growth_events_once_per_account
  ON public.growth_events (account_id, type) WHERE type = 'email_verified';
CREATE INDEX IF NOT EXISTS growth_events_occurred_idx ON public.growth_events (occurred_at);

ALTER TABLE public.attribution_touches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.attribution_touches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.growth_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.attribution_touches TO service_role;
GRANT ALL ON TABLE public.growth_events TO service_role;

-- =============== WRITING A TOUCH ===============
-- One touch from a JSON object (sign-up metadata or the touch cookie), every field checked
-- again. Returns the new row's id, or null when the object holds nothing worth keeping.
-- _at_default is used when the object carries no usable time.
CREATE OR REPLACE FUNCTION public.insert_attribution_touch(
  _kind TEXT,
  _account_id UUID,
  _key_id UUID,
  _touch JSONB,
  _at_default TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv TEXT;
  v_src TEXT;
  v_med TEXT;
  v_cmp TEXT;
  v_ref TEXT;
  v_dir TEXT;
  v_at TIMESTAMPTZ;
  v_id UUID;
BEGIN
  IF _touch IS NOT NULL AND jsonb_typeof(_touch) = 'object' THEN
    v_inv := public.attribution_invitation(_touch->>'invitation_id');
    v_src := public.attribution_utm(_touch->>'utm_source');
    v_med := public.attribution_utm(_touch->>'utm_medium');
    v_cmp := public.attribution_utm(_touch->>'utm_campaign');
    v_ref := public.attribution_host(_touch->>'referrer_host');
    v_dir := CASE WHEN _touch->>'directory' IN ('mcp_registry', 'claude_directory', 'smithery', 'glama', 'pulsemcp')
                  THEN _touch->>'directory' END;
    BEGIN
      v_at := (_touch->>'touched_at')::timestamptz;
    EXCEPTION WHEN others THEN
      v_at := NULL;
    END;
  END IF;

  -- A touch is dated when the builder arrived, but never in the future and never older
  -- than the cookie can be.
  IF v_at IS NULL OR v_at > now() + interval '1 minute' OR v_at < now() - interval '30 days' THEN
    v_at := _at_default;
  END IF;

  IF _kind <> 'key_creation'
     AND v_inv IS NULL AND v_src IS NULL AND v_med IS NULL AND v_cmp IS NULL
     AND v_ref IS NULL AND v_dir IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.attribution_touches
    (kind, account_id, key_id, invitation_id, utm_source, utm_medium, utm_campaign,
     referrer_host, directory, occurred_at)
  VALUES (_kind, _account_id, _key_id, v_inv, v_src, v_med, v_cmp, v_ref, v_dir, v_at)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =============== ENROLMENT ===============
-- The app passes the touch cookie as sign-up metadata (signInWithOtp options.data.attribution),
-- which Supabase keeps only when the account is created, so this runs once per account and
-- survives the magic link being opened in another browser. Attribution must never stop a
-- sign-up: any failure here is swallowed.
CREATE OR REPLACE FUNCTION public.record_enrolment_touch()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.insert_attribution_touch(
      'enrolment', NEW.id, NULL, NEW.raw_user_meta_data->'attribution', now());
  EXCEPTION WHEN others THEN
    RAISE WARNING 'enrolment touch not recorded (%)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_attribution ON auth.users;
CREATE TRIGGER on_auth_user_created_attribution
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_enrolment_touch();

-- internal (A1 list), else the enrolment touch's label, else direct.
CREATE OR REPLACE FUNCTION public.account_acquisition_source(_account_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.internal_accounts ia WHERE ia.account_id = _account_id)
      THEN 'internal'
    ELSE COALESCE(
      (SELECT t.channel FROM public.attribution_touches t
        WHERE t.account_id = _account_id AND t.kind = 'enrolment'),
      'direct')
  END;
$$;

-- =============== KEYS ===============
-- Called once when a key is created, with the session's touch cookie (or null). With no
-- touch in the session, the key inherits the account's enrolment touch, so an engineer who
-- signed up from an introduction link and created the key in another browser still traces.
-- Writes nothing for a key that already has a touch, so a key's earlier history is never
-- rewritten by a later touch.
CREATE OR REPLACE FUNCTION public.record_key_creation(_key_id UUID, _touch JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account UUID;
  v_created TIMESTAMPTZ;
  v_touch JSONB := _touch;
  v_id UUID;
BEGIN
  SELECT k.user_id, k.created_at INTO v_account, v_created FROM public.api_keys k WHERE k.id = _key_id;
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'unknown_key' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_touch IS NULL OR jsonb_typeof(v_touch) <> 'object' THEN
    SELECT jsonb_build_object(
             'invitation_id', t.invitation_id, 'utm_source', t.utm_source,
             'utm_medium', t.utm_medium, 'utm_campaign', t.utm_campaign,
             'referrer_host', t.referrer_host, 'directory', t.directory,
             'touched_at', t.occurred_at)
      INTO v_touch
      FROM public.attribution_touches t
      WHERE t.account_id = v_account AND t.kind = 'enrolment';
  END IF;

  v_id := public.insert_attribution_touch('key_creation', v_account, _key_id, v_touch, v_created);
  IF v_id IS NOT NULL THEN
    INSERT INTO public.growth_events (type, account_id, source, occurred_at)
    VALUES ('key_created', v_account, public.account_acquisition_source(v_account), v_created);
  END IF;
END;
$$;

-- The first client that used a key: the MCP clientInfo.name or the REST User-Agent's first
-- product token. Kept once; later clients never overwrite it. Returns whether it was kept.
CREATE OR REPLACE FUNCTION public.record_key_client(_key_id UUID, _client TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF _client IS NULL OR _client !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,99}$' THEN
    RETURN false;
  END IF;
  UPDATE public.attribution_touches
     SET client = _client
   WHERE key_id = _key_id AND kind = 'key_creation' AND client IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- =============== SIGN-UP ===============
-- The first verified session of an account. Returns first = true exactly once per account,
-- with the label and invitation id the browser's sign_up event carries.
CREATE OR REPLACE FUNCTION public.record_email_verified(_account_id UUID)
RETURNS TABLE(first BOOLEAN, source TEXT, invitation_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_source TEXT := public.account_acquisition_source(_account_id);
  v_inv TEXT;
  v_id UUID;
BEGIN
  INSERT INTO public.growth_events (type, account_id, source)
  VALUES ('email_verified', _account_id, v_source)
  ON CONFLICT (account_id, type) WHERE type = 'email_verified' DO NOTHING
  RETURNING id INTO v_id;

  SELECT t.invitation_id INTO v_inv
    FROM public.attribution_touches t
   WHERE t.account_id = _account_id AND t.kind = 'enrolment';

  RETURN QUERY SELECT v_id IS NOT NULL, v_source, v_inv;
END;
$$;

-- Service role only, for every function above.
REVOKE EXECUTE ON FUNCTION public.attribution_has_ip(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attribution_utm(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attribution_host(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attribution_invitation(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attribution_channel(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_attribution_touch(text, uuid, uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_enrolment_touch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.account_acquisition_source(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_key_creation(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_key_client(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_email_verified(uuid) FROM PUBLIC, anon, authenticated;
-- The field rules run inside the table's CHECKs and generated column, so whoever writes a
-- row needs them; that is only ever the service role or the functions above.
GRANT EXECUTE ON FUNCTION public.attribution_has_ip(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attribution_utm(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attribution_host(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attribution_invitation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attribution_channel(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.account_acquisition_source(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_key_creation(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_key_client(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_email_verified(uuid) TO service_role;
