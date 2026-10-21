-- Merchant-console module storage. All objects are additive and tenant scoped.

CREATE TABLE public.merchant_console_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  category text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_account_id, category)
);

CREATE INDEX merchant_console_settings_business_idx
  ON public.merchant_console_settings (business_account_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_console_settings TO authenticated;
GRANT ALL ON public.merchant_console_settings TO service_role;
ALTER TABLE public.merchant_console_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant manages own console settings"
ON public.merchant_console_settings FOR ALL TO authenticated
USING (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TRIGGER merchant_console_settings_updated_at
BEFORE UPDATE ON public.merchant_console_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.merchant_bulk_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0 AND row_count <= 100),
  valid_row_count integer NOT NULL DEFAULT 0 CHECK (valid_row_count >= 0 AND valid_row_count <= 100),
  status text NOT NULL DEFAULT 'validated' CHECK (status IN ('validated', 'processing', 'completed', 'failed')),
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchant_bulk_imports_business_idx
  ON public.merchant_bulk_imports (business_account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_bulk_imports TO authenticated;
GRANT ALL ON public.merchant_bulk_imports TO service_role;
ALTER TABLE public.merchant_bulk_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant manages own bulk imports"
ON public.merchant_bulk_imports FOR ALL TO authenticated
USING (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TRIGGER merchant_bulk_imports_updated_at
BEFORE UPDATE ON public.merchant_bulk_imports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.merchant_webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL CHECK (endpoint_url ~ '^https://'),
  event_types text[] NOT NULL DEFAULT ARRAY['shipment.status_changed']::text[],
  signing_secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_tested_at timestamptz,
  last_test_status integer,
  last_delivery_at timestamptz,
  last_delivery_status integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchant_webhook_subscriptions_business_idx
  ON public.merchant_webhook_subscriptions (business_account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_webhook_subscriptions TO authenticated;
GRANT ALL ON public.merchant_webhook_subscriptions TO service_role;
ALTER TABLE public.merchant_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant manages own webhook subscriptions"
ON public.merchant_webhook_subscriptions FOR ALL TO authenticated
USING (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TRIGGER merchant_webhook_subscriptions_updated_at
BEFORE UPDATE ON public.merchant_webhook_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.merchant_console_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchant_console_activity_logs_business_idx
  ON public.merchant_console_activity_logs (business_account_id, created_at DESC);

GRANT SELECT ON public.merchant_console_activity_logs TO authenticated;
GRANT ALL ON public.merchant_console_activity_logs TO service_role;
ALTER TABLE public.merchant_console_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchant reads own console activity"
ON public.merchant_console_activity_logs FOR SELECT TO authenticated
USING (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_merchant_console_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _action text;
  _resource_type text;
BEGIN
  _row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  _action := lower(TG_OP);
  _resource_type := CASE TG_TABLE_NAME
    WHEN 'merchant_console_settings' THEN 'setting'
    WHEN 'merchant_bulk_imports' THEN 'bulk_import'
    WHEN 'merchant_webhook_subscriptions' THEN 'webhook_subscription'
    ELSE TG_TABLE_NAME
  END;

  INSERT INTO public.merchant_console_activity_logs (
    business_account_id, actor_user_id, action, resource_type, resource_id, details
  ) VALUES (
    _row.business_account_id,
    auth.uid(),
    _action,
    _resource_type,
    _row.id::text,
    CASE
      WHEN TG_TABLE_NAME = 'merchant_console_settings' THEN jsonb_build_object('category', _row.category)
      WHEN TG_TABLE_NAME = 'merchant_bulk_imports' THEN jsonb_build_object('file_name', _row.file_name, 'status', _row.status)
      WHEN TG_TABLE_NAME = 'merchant_webhook_subscriptions' THEN jsonb_build_object('endpoint_url', _row.endpoint_url, 'is_active', _row.is_active)
      ELSE '{}'::jsonb
    END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER log_merchant_console_settings_change
AFTER INSERT OR UPDATE OR DELETE ON public.merchant_console_settings
FOR EACH ROW EXECUTE FUNCTION public.log_merchant_console_change();

CREATE TRIGGER log_merchant_bulk_imports_change
AFTER INSERT OR UPDATE OR DELETE ON public.merchant_bulk_imports
FOR EACH ROW EXECUTE FUNCTION public.log_merchant_console_change();

CREATE TRIGGER log_merchant_webhook_subscriptions_change
AFTER INSERT OR UPDATE OR DELETE ON public.merchant_webhook_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.log_merchant_console_change();

-- API request history becomes visible only to the owning merchant account.
CREATE POLICY "Merchant reads own API request activity"
ON public.merchant_api_requests FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.business_api_keys key
  WHERE key.id = merchant_api_requests.api_key_id
    AND key.business_account_id = public.get_business_account_id(auth.uid())
) OR public.is_admin(auth.uid()));
