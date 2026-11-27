alter table public.feedback_surveys
  add column email_subject text not null default 'Tell us about your ViaSetu order',
  add column email_template text not null default E'Hi {first_name},\n\nWe would value your feedback about order #{order_reference}. It takes only a few minutes:\n\n{link}\n\nThank you,\nTeam ViaSetu';

alter table public.feedback_surveys
  add constraint feedback_surveys_email_subject_check
    check (length(btrim(email_subject)) between 1 and 160),
  add constraint feedback_surveys_email_template_check
    check (length(email_template) between 20 and 4000 and position('{link}' in email_template) > 0);

create table public.feedback_campaigns (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.feedback_surveys(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  channels text[] not null,
  requested_count smallint not null check (requested_count between 1 and 25),
  sent_count smallint not null default 0 check (sent_count >= 0),
  failed_count smallint not null default 0 check (failed_count >= 0),
  skipped_count smallint not null default 0 check (skipped_count >= 0),
  status text not null default 'sending'
    check (status in ('sending', 'completed', 'partial', 'failed')),
  audience_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(audience_summary) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    cardinality(channels) between 1 and 2
    and channels <@ array['sms', 'email']::text[]
  )
);

create table public.feedback_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.feedback_campaigns(id) on delete restrict,
  invitation_id uuid not null references public.feedback_invitations(id) on delete restrict,
  survey_id uuid not null references public.feedback_surveys(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  channel text not null check (channel in ('sms', 'email')),
  recipient_masked text not null check (length(recipient_masked) between 3 and 160),
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'skipped', 'duplicate')),
  provider_log_id uuid,
  error text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (invitation_id, channel)
);

create index feedback_campaigns_survey_created_idx
  on public.feedback_campaigns (survey_id, created_at desc);
create index feedback_deliveries_campaign_idx
  on public.feedback_deliveries (campaign_id, created_at);
create index feedback_deliveries_booking_idx
  on public.feedback_deliveries (booking_id, created_at desc);
create index feedback_deliveries_status_idx
  on public.feedback_deliveries (status, created_at desc);

alter table public.feedback_campaigns enable row level security;
alter table public.feedback_deliveries enable row level security;

create policy "Admins can read feedback campaigns"
  on public.feedback_campaigns for select to authenticated
  using ((select public.is_admin((select auth.uid()))));

create policy "Admins can read feedback deliveries"
  on public.feedback_deliveries for select to authenticated
  using ((select public.is_admin((select auth.uid()))));

revoke all on table public.feedback_campaigns from anon, authenticated;
revoke all on table public.feedback_deliveries from anon, authenticated;
grant select on table public.feedback_campaigns to authenticated;
grant select on table public.feedback_deliveries to authenticated;

comment on table public.feedback_campaigns is
  'Auditable super-admin feedback campaigns. Customer contact values are not stored here.';
comment on table public.feedback_deliveries is
  'Per-channel feedback invitation delivery audit. Only masked recipient values are retained.';
comment on column public.feedback_surveys.email_template is
  'Plain-text email copy. {link} is required; {first_name} and {order_reference} are supported.';
