CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  template_id text NOT NULL DEFAULT '',
  template_name text NOT NULL DEFAULT '',
  variables text[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sms templates"
ON public.sms_templates FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Operations can update sms templates"
ON public.sms_templates FOR UPDATE TO authenticated
USING (public.is_operations(auth.uid()))
WITH CHECK (public.is_operations(auth.uid()));

CREATE POLICY "Super admins can insert sms templates"
ON public.sms_templates FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_sms_templates_updated_at
BEFORE UPDATE ON public.sms_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sms_templates (event_key, label, description, variables) VALUES
  ('ORDER_PLACED', 'Order Placed', 'Sent to the customer right after a booking is created.', ARRAY['order_id','courier','amount']),
  ('ORDER_FAILED', 'Order Failed', 'Sent when shipment creation with the courier partner fails.', ARRAY['order_id','failure_reason']),
  ('ORDER_CANCELLED', 'Order Cancelled', 'Sent when an order is cancelled and/or refunded.', ARRAY['order_id','refund_reason']),
  ('ORDER_CONFIRMED', 'Order Confirmed', 'Sent when the AWB is generated and the shipment is confirmed.', ARRAY['order_id','awb','courier']);
