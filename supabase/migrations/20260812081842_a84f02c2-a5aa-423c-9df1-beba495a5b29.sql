CREATE TABLE public.booking_balance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text,
  previous_courier_name text,
  previous_amount numeric NOT NULL DEFAULT 0,
  new_courier_name text,
  new_amount numeric NOT NULL DEFAULT 0,
  amount_due numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  collection_mode text NOT NULL DEFAULT 'in_app',
  razorpay_payment_link_id text,
  razorpay_payment_link_url text,
  razorpay_order_id text,
  payment_id text,
  paid_at timestamp with time zone,
  waive_reason text,
  waived_by text,
  book_after_payment boolean NOT NULL DEFAULT false,
  created_by_admin_id uuid,
  created_by_admin_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_bbp_booking ON public.booking_balance_payments(booking_id);
CREATE INDEX idx_bbp_status ON public.booking_balance_payments(status);

GRANT SELECT ON public.booking_balance_payments TO authenticated;
GRANT ALL ON public.booking_balance_payments TO service_role;

ALTER TABLE public.booking_balance_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage balance payments"
ON public.booking_balance_payments FOR ALL
TO authenticated
USING (public.is_operations(auth.uid()))
WITH CHECK (public.is_operations(auth.uid()));

CREATE POLICY "Customers view their own balance payments"
ON public.booking_balance_payments FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_bbp_updated_at
BEFORE UPDATE ON public.booking_balance_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();