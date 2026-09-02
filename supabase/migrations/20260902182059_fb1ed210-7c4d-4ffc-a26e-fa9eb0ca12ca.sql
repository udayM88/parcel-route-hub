-- 1. Courier status audit trail
CREATE TABLE public.shipment_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  awb text,
  courier_name text,
  partner_key text,
  raw_status text,
  raw_code text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_status text NOT NULL,
  previous_status text,
  event_time timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'cron',
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sse_booking_created ON public.shipment_status_events (booking_id, created_at DESC);
CREATE INDEX idx_sse_awb ON public.shipment_status_events (awb);

GRANT SELECT ON public.shipment_status_events TO authenticated;
GRANT ALL ON public.shipment_status_events TO service_role;

ALTER TABLE public.shipment_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view shipment status events"
ON public.shipment_status_events FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 2. SMS decision + delivery log
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  booking_id uuid,
  status_event_id uuid REFERENCES public.shipment_status_events(id) ON DELETE SET NULL,
  awb text,
  to_phone text,
  template_id text,
  variables text[] NOT NULL DEFAULT '{}',
  message_preview text,
  status text NOT NULL,
  reason text,
  provider_response jsonb,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_logs_created ON public.sms_logs (created_at DESC);
CREATE INDEX idx_sms_logs_booking ON public.sms_logs (booking_id);

GRANT SELECT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sms logs"
ON public.sms_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. Extend SMS template configuration
ALTER TABLE public.sms_templates
  ADD COLUMN recipients text[] NOT NULL DEFAULT '{}',
  ADD COLUMN send_to_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN trigger_statuses text[] NOT NULL DEFAULT '{}';

UPDATE public.sms_templates SET trigger_statuses = ARRAY[event_key];

INSERT INTO public.sms_templates (event_key, label, description, variables, trigger_statuses) VALUES
  ('IN_TRANSIT', 'In Transit', 'Shipment picked up and moving through the courier network.', ARRAY['order_id','awb','courier'], ARRAY['IN_TRANSIT']),
  ('OUT_FOR_DELIVERY', 'Out for Delivery', 'Courier is out for delivery at the destination.', ARRAY['order_id','awb','receiver_name'], ARRAY['OUT_FOR_DELIVERY']),
  ('DELIVERED', 'Delivered', 'Shipment delivered to the receiver.', ARRAY['order_id','awb','receiver_name'], ARRAY['DELIVERED']),
  ('DELAYED', 'Delayed', 'Courier reported an exception or delay.', ARRAY['order_id','awb','failure_reason'], ARRAY['DELAYED']),
  ('RETURNED', 'Returned (RTO)', 'Shipment is being returned to origin.', ARRAY['order_id','awb','courier'], ARRAY['RETURNED'])
ON CONFLICT (event_key) DO NOTHING;
