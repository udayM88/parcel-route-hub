ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_stage text,
  ADD COLUMN IF NOT EXISTS cancellation_fee numeric,
  ADD COLUMN IF NOT EXISTS cancellation_fee_gst numeric,
  ADD COLUMN IF NOT EXISTS refund_amount numeric;
INSERT INTO public.system_settings(key, value, description)
VALUES ('cancellation_fees', '{"enabled":true,"grace_minutes":30,"stages":{"grace":{"courier":0,"platform":35},"pre_pickup":{"courier":30,"platform":35},"pickup_attempted":{"courier":60,"platform":39}}}'::jsonb,
 'Stage-based customer cancellation charges (GST-inclusive totals)')
ON CONFLICT (key) DO NOTHING;