-- Additive hardening for merchant API credentials.
-- Existing keys keep full backwards-compatible access and never expire.

ALTER TABLE public.business_api_keys
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY[
    'rates:read',
    'shipments:read',
    'shipments:write',
    'shipments:cancel',
    'wallet:read'
  ]::text[],
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer NOT NULL DEFAULT 120;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_api_keys_rate_limit_check'
      AND conrelid = 'public.business_api_keys'::regclass
  ) THEN
    ALTER TABLE public.business_api_keys
      ADD CONSTRAINT business_api_keys_rate_limit_check
      CHECK (rate_limit_per_minute BETWEEN 1 AND 1000);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS business_api_keys_expiry_idx
  ON public.business_api_keys (expires_at)
  WHERE expires_at IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.merchant_api_rate_limits (
  api_key_id uuid NOT NULL REFERENCES public.business_api_keys(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (api_key_id, window_start)
);

ALTER TABLE public.merchant_api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.merchant_api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.merchant_api_rate_limits TO service_role;

-- Atomically increments a fixed one-minute bucket. Only the service role may call it.
CREATE OR REPLACE FUNCTION public.merchant_api_consume_rate_limit(
  _api_key_id uuid,
  _limit integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window_start timestamptz := date_trunc('minute', clock_timestamp());
  _request_count integer;
  _safe_limit integer := GREATEST(1, LEAST(COALESCE(_limit, 120), 1000));
  _retry_after integer;
BEGIN
  INSERT INTO public.merchant_api_rate_limits(api_key_id, window_start, request_count)
  VALUES (_api_key_id, _window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = public.merchant_api_rate_limits.request_count + 1
  RETURNING request_count INTO _request_count;

  _retry_after := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM ((_window_start + interval '1 minute') - clock_timestamp())))::integer
  );

  RETURN jsonb_build_object(
    'allowed', _request_count <= _safe_limit,
    'limit', _safe_limit,
    'remaining', GREATEST(0, _safe_limit - _request_count),
    'retry_after', _retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_api_consume_rate_limit(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_api_consume_rate_limit(uuid, integer)
  TO service_role;
