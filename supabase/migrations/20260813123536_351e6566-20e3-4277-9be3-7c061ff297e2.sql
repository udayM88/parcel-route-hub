ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS razorpay_order_id text;
CREATE INDEX IF NOT EXISTS idx_bookings_razorpay_order_id ON public.bookings (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_id ON public.bookings (payment_id);