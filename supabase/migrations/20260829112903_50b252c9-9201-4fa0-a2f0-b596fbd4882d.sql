INSERT INTO public.email_templates (event_key, label, description, enabled, to_recipients, cc_recipients, send_to_customer, subject, body_html)
VALUES (
  'business_welcome',
  'Business Account Created (Password Setup)',
  'Sent to a new business customer with a link to set their password.',
  true,
  '{}',
  '{}',
  false,
  'Set up your ViaSetu business account password',
  '<p>Hi {{contact_person}},</p><p>Your ViaSetu business account for <strong>{{company_name}}</strong> has been created.</p><p>Please set your password using the secure link below. The link is valid for 24 hours.</p><p><a href="{{setup_link}}" style="display:inline-block;background:#06b6d4;color:#000;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Set My Password</a></p><p>If the button does not work, copy and paste this link into your browser:<br/><span style="word-break:break-all;">{{setup_link}}</span></p><p>Login email: <strong>{{email}}</strong><br/>Portal: <a href="{{portal_link}}">{{portal_link}}</a></p><p>Need help? Write to support@viasetu.com or call +91 90139 99909.</p><p>— Team ViaSetu</p>'
)
ON CONFLICT (event_key) DO NOTHING;