-- Secure, additive WooCommerce connection handshake.
-- No merchant password or plaintext API key is persisted in the database.

CREATE TABLE IF NOT EXISTS public.merchant_integration_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'woocommerce' CHECK (platform IN ('woocommerce')),
  environment text NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  store_name text NOT NULL,
  site_url text NOT NULL CHECK (site_url ~ '^https://'),
  redirect_uri text NOT NULL CHECK (redirect_uri ~ '^https://'),
  webhook_url text NOT NULL CHECK (webhook_url ~ '^https://'),
  code_challenge text NOT NULL CHECK (char_length(code_challenge) BETWEEN 43 AND 128),
  plugin_version text NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_integration_authorizations_expiry_idx
  ON public.merchant_integration_authorizations (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.merchant_integration_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_integration_authorizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.merchant_integration_authorizations TO service_role;

CREATE TABLE IF NOT EXISTS public.merchant_store_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES public.business_api_keys(id) ON DELETE CASCADE,
  webhook_subscription_id uuid REFERENCES public.merchant_webhook_subscriptions(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'woocommerce' CHECK (platform IN ('woocommerce')),
  environment text NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  store_name text NOT NULL,
  site_url text NOT NULL CHECK (site_url ~ '^https://'),
  plugin_version text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected')),
  last_seen_at timestamptz,
  disconnected_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_store_connections_active_store_idx
  ON public.merchant_store_connections (business_account_id, platform, site_url)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS merchant_store_connections_business_idx
  ON public.merchant_store_connections (business_account_id, created_at DESC);

GRANT SELECT ON public.merchant_store_connections TO authenticated;
GRANT ALL ON public.merchant_store_connections TO service_role;
ALTER TABLE public.merchant_store_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant reads own store connections"
ON public.merchant_store_connections FOR SELECT TO authenticated
USING (
  business_account_id = public.get_business_account_id(auth.uid())
  OR public.is_admin(auth.uid())
);

CREATE TRIGGER merchant_store_connections_updated_at
BEFORE UPDATE ON public.merchant_store_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.exchange_woocommerce_authorization(
  _code_hash text,
  _code_challenge text,
  _site_url text,
  _redirect_uri text,
  _webhook_url text,
  _key_prefix text,
  _key_hash text,
  _signing_secret text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _authorization public.merchant_integration_authorizations;
  _key_id uuid;
  _webhook_id uuid;
  _connection_id uuid;
  _old_connection record;
BEGIN
  SELECT * INTO _authorization
  FROM public.merchant_integration_authorizations
  WHERE code_hash = _code_hash
  FOR UPDATE;

  IF NOT FOUND
    OR _authorization.used_at IS NOT NULL
    OR _authorization.expires_at <= clock_timestamp()
    OR _authorization.code_challenge <> _code_challenge
    OR _authorization.site_url <> _site_url
    OR _authorization.redirect_uri <> _redirect_uri
    OR _authorization.webhook_url <> _webhook_url THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired_code');
  END IF;

  IF (
    SELECT count(*)
    FROM public.business_api_keys api_key
    WHERE api_key.business_account_id = _authorization.business_account_id
      AND api_key.revoked_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.merchant_store_connections connection
        WHERE connection.api_key_id = api_key.id
          AND connection.business_account_id = _authorization.business_account_id
          AND connection.platform = 'woocommerce'
          AND connection.site_url = _authorization.site_url
          AND connection.status = 'active'
      )
  ) >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'active_key_limit');
  END IF;

  FOR _old_connection IN
    SELECT id, api_key_id, webhook_subscription_id
    FROM public.merchant_store_connections
    WHERE business_account_id = _authorization.business_account_id
      AND platform = 'woocommerce'
      AND site_url = _authorization.site_url
      AND status = 'active'
    FOR UPDATE
  LOOP
    UPDATE public.business_api_keys
      SET revoked_at = COALESCE(revoked_at, clock_timestamp())
      WHERE id = _old_connection.api_key_id;
    UPDATE public.merchant_webhook_subscriptions
      SET is_active = false
      WHERE id = _old_connection.webhook_subscription_id;
    UPDATE public.merchant_store_connections
      SET status = 'disconnected', disconnected_at = clock_timestamp()
      WHERE id = _old_connection.id;
  END LOOP;

  UPDATE public.merchant_integration_authorizations
    SET used_at = clock_timestamp()
    WHERE id = _authorization.id;

  INSERT INTO public.business_api_keys (
    business_account_id, name, key_prefix, key_hash, environment,
    scopes, expires_at, rate_limit_per_minute, created_by
  ) VALUES (
    _authorization.business_account_id,
    left('WooCommerce: ' || _authorization.store_name, 60),
    _key_prefix,
    _key_hash,
    _authorization.environment,
    ARRAY['rates:read', 'shipments:read', 'shipments:write', 'shipments:cancel', 'wallet:read']::text[],
    NULL,
    120,
    _authorization.created_by
  ) RETURNING id INTO _key_id;

  INSERT INTO public.merchant_webhook_subscriptions (
    business_account_id, endpoint_url, event_types, signing_secret,
    is_active, created_by
  ) VALUES (
    _authorization.business_account_id,
    _authorization.webhook_url,
    ARRAY['shipment.status_changed']::text[],
    _signing_secret,
    true,
    _authorization.created_by
  ) RETURNING id INTO _webhook_id;

  INSERT INTO public.merchant_store_connections (
    business_account_id, api_key_id, webhook_subscription_id,
    platform, environment, store_name, site_url, plugin_version,
    status, last_seen_at, created_by
  ) VALUES (
    _authorization.business_account_id,
    _key_id,
    _webhook_id,
    'woocommerce',
    _authorization.environment,
    _authorization.store_name,
    _authorization.site_url,
    _authorization.plugin_version,
    'active',
    clock_timestamp(),
    _authorization.created_by
  ) RETURNING id INTO _connection_id;

  INSERT INTO public.merchant_console_activity_logs (
    business_account_id, actor_user_id, action, resource_type, resource_id, details
  ) VALUES (
    _authorization.business_account_id,
    _authorization.created_by,
    'connect',
    'store_connection',
    _connection_id::text,
    jsonb_build_object(
      'platform', 'woocommerce',
      'site_url', _authorization.site_url,
      'plugin_version', _authorization.plugin_version
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'business_account_id', _authorization.business_account_id,
    'api_key_id', _key_id,
    'connection_id', _connection_id,
    'environment', _authorization.environment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.exchange_woocommerce_authorization(
  text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exchange_woocommerce_authorization(
  text, text, text, text, text, text, text, text
) TO service_role;
