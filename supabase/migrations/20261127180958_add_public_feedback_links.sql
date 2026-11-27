alter table public.feedback_surveys
  add column public_enabled boolean not null default false;

alter table public.feedback_responses
  alter column invitation_id drop not null,
  alter column booking_id drop not null;

alter table public.feedback_responses
  drop constraint if exists feedback_responses_source_check;

alter table public.feedback_responses
  add constraint feedback_responses_source_check
  check (source in ('web', 'sms', 'email', 'whatsapp', 'preview', 'shared'));

alter table public.feedback_responses
  add constraint feedback_responses_context_check
  check (
    (invitation_id is not null and booking_id is not null)
    or (invitation_id is null and booking_id is null and source = 'shared')
  );

update public.feedback_surveys
set public_enabled = true,
    updated_at = now()
where slug in ('quick-order-feedback', 'customer-experience');

grant update (public_enabled, updated_at)
  on table public.feedback_surveys to authenticated;

comment on column public.feedback_surveys.public_enabled is
  'Allows the published survey to accept reusable, non-order-linked responses through the validated Edge Function.';

comment on constraint feedback_responses_context_check on public.feedback_responses is
  'Order invitations retain both references; reusable shared-link responses retain neither.';
