create table public.feedback_surveys (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  form_type text not null check (form_type in ('quick', 'detailed', 'custom')),
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'paused')),
  estimated_minutes smallint not null check (estimated_minutes between 1 and 30),
  question_count smallint not null check (question_count between 1 and 50),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 50),
  sms_template text not null,
  dlt_template_id text,
  version smallint not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (question_count = jsonb_array_length(questions)),
  check (position('{#var#}' in sms_template) > 0)
);

create table public.feedback_invitations (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.feedback_surveys(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.feedback_responses (
  id bigint generated always as identity primary key,
  survey_id uuid not null references public.feedback_surveys(id) on delete restrict,
  invitation_id uuid not null unique references public.feedback_invitations(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  nps_score smallint check (nps_score between 0 and 10),
  overall_rating smallint check (overall_rating between 1 and 5),
  source text not null default 'web' check (source in ('web', 'sms', 'email', 'whatsapp', 'preview')),
  submission_fingerprint text not null check (length(submission_fingerprint) = 64),
  client_elapsed_ms integer not null check (client_elapsed_ms between 2500 and 86400000),
  submitted_at timestamptz not null default now()
);

create index feedback_invitations_survey_idx on public.feedback_invitations (survey_id);
create index feedback_invitations_booking_idx on public.feedback_invitations (booking_id);
create index feedback_invitations_user_idx on public.feedback_invitations (user_id);
create index feedback_invitations_active_booking_idx
  on public.feedback_invitations (booking_id, expires_at desc)
  where used_at is null and revoked_at is null;
create index feedback_responses_survey_submitted_idx
  on public.feedback_responses (survey_id, submitted_at desc);
create index feedback_responses_booking_idx on public.feedback_responses (booking_id);
create index feedback_responses_submitted_idx on public.feedback_responses (submitted_at desc);
create index feedback_responses_fingerprint_idx
  on public.feedback_responses (submission_fingerprint, submitted_at desc);

alter table public.feedback_surveys enable row level security;
alter table public.feedback_invitations enable row level security;
alter table public.feedback_responses enable row level security;

create policy "Admins can read feedback surveys"
  on public.feedback_surveys for select to authenticated
  using ((select public.is_admin((select auth.uid()))));

create policy "Super admins can update feedback surveys"
  on public.feedback_surveys for update to authenticated
  using ((select public.is_super_admin((select auth.uid()))))
  with check ((select public.is_super_admin((select auth.uid()))));

create policy "Admins can read feedback invitations"
  on public.feedback_invitations for select to authenticated
  using ((select public.is_admin((select auth.uid()))));

create policy "Admins can read feedback responses"
  on public.feedback_responses for select to authenticated
  using ((select public.is_admin((select auth.uid()))));

revoke all on table public.feedback_surveys from anon, authenticated;
revoke all on table public.feedback_invitations from anon, authenticated;
revoke all on table public.feedback_responses from anon, authenticated;

grant select on table public.feedback_surveys to authenticated;
grant update (status, sms_template, updated_at) on table public.feedback_surveys to authenticated;
grant select (id, survey_id, booking_id, user_id, expires_at, used_at, revoked_at, created_by, created_at)
  on table public.feedback_invitations to authenticated;
grant select (id, survey_id, invitation_id, booking_id, answers, nps_score, overall_rating, source, client_elapsed_ms, submitted_at)
  on table public.feedback_responses to authenticated;

insert into public.feedback_surveys
  (id, slug, form_type, title, description, status, estimated_minutes, question_count, questions, sms_template)
values
(
  '2adff0b3-c853-4e0f-b63c-3791f2245a4d', 'quick-order-feedback', 'quick', 'Quick order feedback',
  'A short check-in about the customer''s latest ViaSetu order and delivery.', 'published', 2, 7,
  $json$[
    {"id":"overall_rating","title":"How satisfied are you with your overall ViaSetu experience?","section":"overall","type":"stars","required":true},
    {"id":"delivery_rating","title":"How would you rate your delivery experience?","section":"order","type":"single","options":["Very poor","Poor","Average","Good","Excellent"],"required":true},
    {"id":"delivery_timing","title":"Was your order delivered within the expected time?","section":"order","type":"single","options":["Yes","No","Partially"],"required":true},
    {"id":"ordering_easy","title":"Was it easy to place your order?","section":"order","type":"single","options":["Yes","No","Somewhat"],"required":true},
    {"id":"improvements","title":"What could we improve?","helper":"Optional","section":"future","type":"text","maxLength":1000},
    {"id":"nps_score","title":"How likely are you to recommend ViaSetu to a friend or colleague?","helper":"0 means not at all likely; 10 means extremely likely.","section":"future","type":"nps","required":true},
    {"id":"comments","title":"Any other suggestion for us?","helper":"Optional","section":"future","type":"text","maxLength":1500}
  ]$json$::jsonb,
  'Dear Customer, thank you for placing your order with ViaSetu. We value your feedback and would love to know about your experience. Please share your feedback here: {#var#}'
),
(
  '19cad4ce-dd52-4055-88d5-b7b809a67678', 'customer-experience', 'detailed', 'Help us serve you better',
  'A detailed order-linked survey covering ordering, delivery, support and loyalty.', 'published', 5, 17,
  $json$[
    {"id":"overall_rating","title":"How satisfied are you with your overall ViaSetu experience?","section":"overall","type":"stars","required":true},
    {"id":"nps_score","title":"How likely are you to recommend ViaSetu to a friend or colleague?","helper":"0 means not at all likely; 10 means extremely likely.","section":"overall","type":"nps","required":true},
    {"id":"ordering_issues","title":"Did you face any issue while placing your order?","section":"order","type":"multi","options":["Website or app was slow","Products or services were unavailable","Options were limited","I had trouble making a payment","Payment was deducted but order was not confirmed","The ordering process was confusing","There were no issues","Other"],"otherAnswerKey":"ordering_issues_other","required":true},
    {"id":"delivery_issues","title":"Did you face any issue with the delivery?","section":"order","type":"multi","options":["The order was delayed","The delivery executive was not professional","The delivery executive was difficult to contact","The order was delivered to the wrong location","The order had missing items","The order had incorrect items","Products were damaged","Packaging was dirty or damaged","Product quality was poor","The order was cancelled unexpectedly","Tracking information was inaccurate","There were no issues","Other"],"otherAnswerKey":"delivery_issues_other","required":true},
    {"id":"ordering_rating","title":"How satisfied were you with the ordering experience?","section":"order","type":"single","options":["Very poor","Poor","Average","Good","Excellent"],"required":true},
    {"id":"delivery_rating","title":"How satisfied were you with the delivery experience?","section":"order","type":"single","options":["Very poor","Poor","Average","Good","Excellent"],"required":true},
    {"id":"tracking_rating","title":"How satisfied were you with communication and tracking updates?","section":"order","type":"single","options":["Very poor","Poor","Average","Good","Excellent","I did not use tracking"],"required":true},
    {"id":"support_rating","title":"How would you rate customer support?","section":"order","type":"single","options":["Excellent","Good","Average","Poor","Very poor","I did not contact support"],"required":true},
    {"id":"delivery_timing","title":"When did your order arrive?","section":"order","type":"single","options":["On time","Earlier than expected","Later than expected","I was not informed of a delivery time"],"required":true},
    {"id":"overall_comparison","title":"Compared with another service, how was your overall ViaSetu experience?","section":"comparison","type":"single","options":["Much better","Slightly better","There is no difference","Slightly worse","Much worse","I have not used another service"],"required":true},
    {"id":"speed_comparison","title":"How did our delivery speed compare?","section":"comparison","type":"single","options":["ViaSetu was faster","There was no difference","ViaSetu was slower","I have not used another service"],"required":true},
    {"id":"quality_comparison","title":"How did product or service quality compare?","section":"comparison","type":"single","options":["ViaSetu was better","There was no difference","ViaSetu was poorer","I have not used another service"],"required":true},
    {"id":"price_comparison","title":"How did pricing and delivery charges compare?","section":"comparison","type":"single","options":["ViaSetu was lower","There was no difference","ViaSetu was higher","I have not used another service"],"required":true},
    {"id":"order_again","title":"How likely are you to order with ViaSetu again?","section":"future","type":"single","options":["Definitely","Probably","Not sure","Probably not","Definitely not"],"required":true},
    {"id":"improve_first","title":"What should ViaSetu improve first?","section":"future","type":"single","options":["Faster delivery","Better product quality","Better pricing","More options","A better app or website","Better tracking updates","Better customer support","A better delivery experience","Other"],"otherAnswerKey":"improve_first_other","required":true},
    {"id":"contact_consent","title":"May ViaSetu contact you for offers, updates and research?","section":"future","type":"single","options":["Yes, I agree to be contacted","No, I do not wish to be contacted"],"required":true},
    {"id":"comments","title":"Do you have any other comments, questions or concerns?","helper":"Optional","section":"future","type":"text","maxLength":1500}
  ]$json$::jsonb,
  'Dear Customer, we hope you had a great experience with ViaSetu. Please take a moment to rate your delivery experience. Your feedback helps us improve: {#var#}'
)
on conflict (slug) do nothing;

create or replace function public.submit_feedback_response(
  p_invitation_id uuid,
  p_answers jsonb,
  p_nps_score smallint,
  p_overall_rating smallint,
  p_source text,
  p_submission_fingerprint text,
  p_client_elapsed_ms integer
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_survey_id uuid;
  v_booking_id uuid;
  v_response_id bigint;
begin
  update public.feedback_invitations
  set used_at = now()
  where id = p_invitation_id
    and used_at is null
    and revoked_at is null
    and expires_at > now()
  returning survey_id, booking_id into v_survey_id, v_booking_id;

  if not found then
    raise exception 'feedback_invitation_unavailable' using errcode = 'P0001';
  end if;

  insert into public.feedback_responses (
    survey_id,
    invitation_id,
    booking_id,
    answers,
    nps_score,
    overall_rating,
    source,
    submission_fingerprint,
    client_elapsed_ms
  ) values (
    v_survey_id,
    p_invitation_id,
    v_booking_id,
    p_answers,
    p_nps_score,
    p_overall_rating,
    p_source,
    p_submission_fingerprint,
    p_client_elapsed_ms
  )
  returning id into v_response_id;

  return v_response_id;
end;
$$;

revoke all on function public.submit_feedback_response(uuid, jsonb, smallint, smallint, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.submit_feedback_response(uuid, jsonb, smallint, smallint, text, text, integer)
  to service_role;
grant usage, select on sequence public.feedback_responses_id_seq to service_role;

comment on table public.feedback_surveys is 'ViaSetu customer feedback campaign managed by authorised admins.';
comment on table public.feedback_invitations is 'Single-use, expiring, order-linked feedback invitations. Only token hashes are stored.';
comment on table public.feedback_responses is 'Validated order-linked survey submissions written atomically through the feedback-survey Edge Function.';
