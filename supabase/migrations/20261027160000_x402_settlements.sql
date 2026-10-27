-- A5 (growth-legibility APP-PHASE-1): log x402 calls.
--
-- The product North Star compares mainnet agent revenue with human sign-up revenue, and until
-- now an x402 call wrote no row, so neither the app nor the growth engine could see one.
--
-- What this adds (all service role only):
--   x402_settlements           one row per x402 payment, keyed by a hash of the payment's own
--                              id (its EIP-3009 nonce), so a retried payment never writes a
--                              second row. Network is base-sepolia unless the payment really
--                              settled on Base mainnet; payer is agent; the USD amount is
--                              converted with a dated rate the row keeps. Never a wallet
--                              address, a transaction payload or the X-PAYMENT header.
--   record_x402_settlement()   the write, idempotent: a retry of a settled payment changes
--                              nothing, and a failed attempt that later settles becomes settled.
--   capture_sources            when the app began recording a section, so the export vouches
--                              for a window only from then on.
--   growth_export_counts() / growth_export_rows()  replaced to carry settlements.

CREATE TABLE IF NOT EXISTS public.x402_settlements (
  payment_id TEXT PRIMARY KEY CHECK (payment_id ~ '^[0-9a-f]{64}$'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  network TEXT NOT NULL CHECK (network IN ('base-sepolia', 'base-mainnet')),
  status TEXT NOT NULL CHECK (status IN ('settled', 'failed')),
  payer TEXT NOT NULL DEFAULT 'agent' CHECK (payer IN ('agent', 'human')),
  amount_usd NUMERIC(14, 6) NOT NULL CHECK (amount_usd >= 0),
  usd_rate NUMERIC(12, 6) NOT NULL CHECK (usd_rate > 0),
  rate_as_of DATE NOT NULL,
  tool TEXT CHECK (tool ~ '^[a-z_]{1,40}$'),
  failure_reason TEXT CHECK (length(failure_reason) <= 200)
);
COMMENT ON TABLE public.x402_settlements IS 'One row per x402 payment, keyed by a hash of its nonce. No wallet address, payload or header. Service role only.';
CREATE INDEX IF NOT EXISTS x402_settlements_occurred_idx ON public.x402_settlements (occurred_at);

CREATE TABLE IF NOT EXISTS public.capture_sources (
  section TEXT PRIMARY KEY,
  captured_since TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL
);
COMMENT ON TABLE public.capture_sources IS 'When the app began recording each export section. Move a date earlier only with evidence that nothing went unrecorded before it.';
INSERT INTO public.capture_sources (section, captured_since, note)
VALUES ('settlements', now(), 'x402 calls are recorded from the moment migration 20261027160000 was applied.')
ON CONFLICT (section) DO NOTHING;

ALTER TABLE public.x402_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.x402_settlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.capture_sources FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.x402_settlements TO service_role;
GRANT ALL ON TABLE public.capture_sources TO service_role;

CREATE OR REPLACE FUNCTION public.record_x402_settlement(
  _payment_id TEXT,
  _network TEXT,
  _status TEXT,
  _amount_usd NUMERIC,
  _usd_rate NUMERIC,
  _rate_as_of DATE,
  _tool TEXT,
  _failure_reason TEXT
)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.x402_settlements
    (payment_id, network, status, payer, amount_usd, usd_rate, rate_as_of, tool, failure_reason)
  VALUES (_payment_id, _network, _status, 'agent', _amount_usd, _usd_rate, _rate_as_of, _tool,
          CASE WHEN _status = 'failed' THEN left(_failure_reason, 200) END)
  ON CONFLICT (payment_id) DO UPDATE
    SET status = 'settled', occurred_at = now(), failure_reason = NULL,
        amount_usd = EXCLUDED.amount_usd, usd_rate = EXCLUDED.usd_rate,
        rate_as_of = EXCLUDED.rate_as_of
    WHERE public.x402_settlements.status = 'failed' AND EXCLUDED.status = 'settled';
$$;

-- =============== THE EXPORT, WITH SETTLEMENTS ===============
-- growth_export_counts gains the settlements count and when settlement capture began, so its
-- result type changes: it is dropped and created again.
DROP FUNCTION IF EXISTS public.growth_export_counts(timestamptz, timestamptz, timestamptz);
CREATE FUNCTION public.growth_export_counts(
  _start TIMESTAMPTZ,
  _end TIMESTAMPTZ,
  _captured_at TIMESTAMPTZ
)
RETURNS TABLE(accounts BIGINT, reads BIGINT, events BIGINT, settlements BIGINT, settlements_since TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM auth.users u WHERE u.created_at <= _captured_at),
    (SELECT COUNT(*) FROM public.usage_events ue WHERE ue.created_at >= _start AND ue.created_at < _end),
    (SELECT COUNT(*) FROM public.growth_events ge WHERE ge.occurred_at >= _start AND ge.occurred_at < _end),
    (SELECT COUNT(*) FROM public.x402_settlements x WHERE x.occurred_at >= _start AND x.occurred_at < _end),
    (SELECT public.export_instant(c.captured_since) FROM public.capture_sources c WHERE c.section = 'settlements');
$$;

CREATE OR REPLACE FUNCTION public.growth_export_settlements(_start TIMESTAMPTZ, _end TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.payment_id,
    'occurred_at', public.export_instant(x.occurred_at),
    'network', x.network,
    'status', x.status,
    'payer', x.payer,
    'amount_usd', x.amount_usd
  ) ORDER BY x.occurred_at, x.payment_id), '[]'::jsonb)
  FROM public.x402_settlements x
  WHERE x.occurred_at >= _start AND x.occurred_at < _end;
$$;

REVOKE EXECUTE ON FUNCTION public.record_x402_settlement(text, text, text, numeric, numeric, date, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.growth_export_counts(timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.growth_export_settlements(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_x402_settlement(text, text, text, numeric, numeric, date, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.growth_export_counts(timestamptz, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.growth_export_settlements(timestamptz, timestamptz) TO service_role;
