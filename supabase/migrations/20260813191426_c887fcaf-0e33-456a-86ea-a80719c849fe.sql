CREATE TABLE public.business_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  business_type text NOT NULL,
  monthly_volume text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  notes text,
  source text NOT NULL DEFAULT 'for-business',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.business_inquiries TO authenticated;
GRANT ALL ON public.business_inquiries TO service_role;

ALTER TABLE public.business_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view business inquiries"
ON public.business_inquiries FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update business inquiries"
ON public.business_inquiries FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_business_inquiries_updated_at
BEFORE UPDATE ON public.business_inquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_inquiries_created_at ON public.business_inquiries (created_at DESC);
CREATE INDEX idx_business_inquiries_email ON public.business_inquiries (lower(email));

INSERT INTO public.email_templates (event_key, label, description, enabled, to_recipients, cc_recipients, reply_to, send_to_customer, subject, body_html)
VALUES (
  'business_inquiry',
  'Business Inquiry Received',
  'Sent to the support/admin inbox when a new business inquiry is submitted from the For Business page.',
  true,
  ARRAY['support@viasetu.com']::text[],
  ARRAY[]::text[],
  NULL,
  false,
  'New Business Inquiry — {{company_name}}',
  '<h3>New Business Inquiry</h3><p><b>Name:</b> {{name}}</p><p><b>Company:</b> {{company_name}}</p><p><b>Email:</b> {{email}}</p><p><b>Phone:</b> {{phone}}</p><p><b>Business Type:</b> {{business_type}}</p><p><b>Monthly Shipment Volume:</b> {{monthly_volume}}</p><p><b>Submitted:</b> {{submitted_at}}</p>'
)
ON CONFLICT (event_key) DO NOTHING;