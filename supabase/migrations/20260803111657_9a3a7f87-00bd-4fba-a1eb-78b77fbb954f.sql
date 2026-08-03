-- 1. Business accounts
CREATE TABLE public.business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_name text NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  pan_number text,
  gst_number text,
  shop_act_number text,
  monthly_shipments integer NOT NULL DEFAULT 0,
  address text,
  city text,
  state text,
  pincode text,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.business_accounts TO authenticated;
GRANT ALL ON public.business_accounts TO service_role;

ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business users can view own account"
ON public.business_accounts FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all business accounts"
ON public.business_accounts FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_business_accounts_updated_at
BEFORE UPDATE ON public.business_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_accounts_user_id ON public.business_accounts(user_id);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_business_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE user_id = _user_id AND is_active = true AND status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_business_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.business_accounts
  WHERE user_id = _user_id AND is_active = true AND status = 'approved'
  LIMIT 1
$$;

-- 2. Bookings additions
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'consumer',
  ADD COLUMN IF NOT EXISTS business_account_id uuid REFERENCES public.business_accounts(id),
  ADD COLUMN IF NOT EXISTS courier_rate numeric,
  ADD COLUMN IF NOT EXISTS retail_price numeric,
  ADD COLUMN IF NOT EXISTS margin_amount numeric,
  ADD COLUMN IF NOT EXISTS box_count integer NOT NULL DEFAULT 1;

-- 3. Booking boxes (multi-box business orders)
CREATE TABLE public.booking_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  box_index integer NOT NULL,
  weight_kg numeric NOT NULL,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  chargeable_weight_kg numeric,
  courier_rate numeric,
  price numeric,
  tracking_id text,
  partner_order_id text,
  label_url text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (booking_id, box_index)
);

GRANT SELECT ON public.booking_boxes TO authenticated;
GRANT ALL ON public.booking_boxes TO service_role;

ALTER TABLE public.booking_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all booking boxes"
ON public.booking_boxes FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Business users can view own booking boxes"
ON public.booking_boxes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.bookings b
  WHERE b.id = booking_boxes.booking_id
    AND b.business_account_id = public.get_business_account_id(auth.uid())
));

CREATE TRIGGER update_booking_boxes_updated_at
BEFORE UPDATE ON public.booking_boxes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_booking_boxes_booking_id ON public.booking_boxes(booking_id);