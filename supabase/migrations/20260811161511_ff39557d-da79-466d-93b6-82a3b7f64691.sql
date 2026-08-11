-- Email templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  to_recipients text[] NOT NULL DEFAULT '{}',
  cc_recipients text[] NOT NULL DEFAULT '{}',
  reply_to text,
  send_to_customer boolean NOT NULL DEFAULT false,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can insert email templates"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update email templates"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email logs
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  booking_id uuid,
  to_email text NOT NULL,
  cc_emails text[] NOT NULL DEFAULT '{}',
  reply_to text,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  provider_response jsonb,
  is_test boolean NOT NULL DEFAULT false,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs"
  ON public.email_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX idx_email_logs_booking ON public.email_logs (booking_id);

-- Duplicate protection for real (non-test) successful notifications
CREATE UNIQUE INDEX uniq_email_logs_event_booking
  ON public.email_logs (booking_id, event_key)
  WHERE is_test = false AND status = 'sent' AND booking_id IS NOT NULL;

-- Seed default templates
INSERT INTO public.email_templates (event_key, label, description, subject, body_html, to_recipients)
VALUES
  ('order_placed', 'Order Placed', 'Sent when a new booking is saved successfully.',
   'New Order {{order_short_id}} placed - {{courier}}',
   '<p>A new order has been placed.</p><p><b>Order:</b> {{order_id}}<br/><b>Courier:</b> {{courier}}<br/><b>AWB:</b> {{awb}}<br/><b>Amount:</b> {{amount}}<br/><b>Sender:</b> {{sender_name}} ({{sender_pincode}})<br/><b>Receiver:</b> {{receiver_name}} ({{receiver_pincode}})</p>',
   ARRAY['uday@viasetu.com']),
  ('order_confirmed', 'Order Confirmed', 'Sent when the shipment is successfully manifested with the courier partner.',
   'Order {{order_short_id}} confirmed - AWB {{awb}}',
   '<p>Your shipment is confirmed.</p><p><b>Order:</b> {{order_id}}<br/><b>Courier:</b> {{courier}}<br/><b>AWB:</b> {{awb}}<br/><b>ETA:</b> {{delivery_time}}</p>',
   ARRAY['uday@viasetu.com']),
  ('order_rejected', 'Order Failed / Rejected', 'Sent when shipment creation fails or is rejected by the partner.',
   'Order {{order_short_id}} failed at partner',
   '<p>Shipment creation failed.</p><p><b>Order:</b> {{order_id}}<br/><b>Courier:</b> {{courier}}<br/><b>Reason:</b> {{failure_reason}}</p>',
   ARRAY['uday@viasetu.com']),
  ('order_cancelled', 'Order Cancelled', 'Sent when an order is cancelled.',
   'Order {{order_short_id}} cancelled',
   '<p>Order {{order_id}} has been cancelled.</p><p><b>Courier:</b> {{courier}}<br/><b>AWB:</b> {{awb}}</p>',
   ARRAY['uday@viasetu.com']),
  ('order_refunded', 'Refund Processed', 'Sent when a refund is processed successfully.',
   'Refund processed for order {{order_short_id}}',
   '<p>A refund has been processed.</p><p><b>Order:</b> {{order_id}}<br/><b>Amount:</b> {{amount}}<br/><b>Reason:</b> {{refund_reason}}</p>',
   ARRAY['uday@viasetu.com']),
  ('order_completed', 'Order Delivered', 'Sent when a shipment is marked delivered.',
   'Order {{order_short_id}} delivered',
   '<p>Order {{order_id}} has been delivered.</p><p><b>Courier:</b> {{courier}}<br/><b>AWB:</b> {{awb}}</p>',
   ARRAY['uday@viasetu.com']),
  ('status_change', 'Important Status Change', 'Sent on important shipment status transitions.',
   'Order {{order_short_id}} status: {{status}}',
   '<p>Status update for order {{order_id}}.</p><p><b>New status:</b> {{status}}<br/><b>Courier:</b> {{courier}}<br/><b>AWB:</b> {{awb}}</p>',
   ARRAY['uday@viasetu.com']);