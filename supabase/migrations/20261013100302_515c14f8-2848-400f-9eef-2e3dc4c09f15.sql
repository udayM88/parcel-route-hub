CREATE TABLE public.business_wallets (
  business_account_id uuid PRIMARY KEY REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  low_balance_threshold numeric NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_wallets TO authenticated;
GRANT ALL ON public.business_wallets TO service_role;
ALTER TABLE public.business_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business reads own wallet" ON public.business_wallets FOR SELECT TO authenticated
  USING (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  razorpay_order_id text,
  payment_id text,
  note text,
  created_by uuid,
  created_by_email text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_biz_idx ON public.wallet_transactions(business_account_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business reads own wallet tx" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE public.business_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  environment text NOT NULL DEFAULT 'live',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_api_keys TO authenticated;
GRANT ALL ON public.business_api_keys TO service_role;
ALTER TABLE public.business_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business reads own api keys" ON public.business_api_keys FOR SELECT TO authenticated
  USING (business_account_id = public.get_business_account_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE public.merchant_api_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.business_api_keys(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  action text NOT NULL,
  booking_id uuid,
  response jsonb,
  status_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_key_id, idempotency_key)
);
GRANT ALL ON public.merchant_api_requests TO service_role;
ALTER TABLE public.merchant_api_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_business_wallets_updated_at BEFORE UPDATE ON public.business_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic, idempotent wallet movement. Positive = credit, negative = debit.
CREATE OR REPLACE FUNCTION public.wallet_apply(
  _business_account_id uuid, _amount numeric, _type text,
  _booking_id uuid DEFAULT NULL, _note text DEFAULT NULL, _idempotency_key text DEFAULT NULL,
  _razorpay_order_id text DEFAULT NULL, _payment_id text DEFAULT NULL,
  _actor uuid DEFAULT NULL, _actor_email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _bal numeric;
  _existing public.wallet_transactions;
  _tx_id uuid;
BEGIN
  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'amount must be non-zero';
  END IF;
  IF _idempotency_key IS NOT NULL THEN
    SELECT * INTO _existing FROM public.wallet_transactions WHERE idempotency_key = _idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', _existing.id, 'balance', _existing.balance_after);
    END IF;
  END IF;

  INSERT INTO public.business_wallets(business_account_id) VALUES (_business_account_id)
    ON CONFLICT (business_account_id) DO NOTHING;
  SELECT balance INTO _bal FROM public.business_wallets WHERE business_account_id = _business_account_id FOR UPDATE;

  IF _bal + _amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance', 'balance', _bal, 'required', -_amount);
  END IF;

  UPDATE public.business_wallets SET balance = _bal + _amount WHERE business_account_id = _business_account_id;
  INSERT INTO public.wallet_transactions(business_account_id, type, amount, balance_after, booking_id, note,
    idempotency_key, razorpay_order_id, payment_id, created_by, created_by_email)
  VALUES (_business_account_id, _type, _amount, _bal + _amount, _booking_id, _note,
    _idempotency_key, _razorpay_order_id, _payment_id, _actor, _actor_email)
  RETURNING id INTO _tx_id;
  RETURN jsonb_build_object('ok', true, 'transaction_id', _tx_id, 'balance', _bal + _amount);
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_apply(uuid, numeric, text, uuid, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_apply(uuid, numeric, text, uuid, text, text, text, text, uuid, text) TO service_role;