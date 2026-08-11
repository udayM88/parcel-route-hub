# Email Notification Layer (inside existing Admin CMS)

Adds a configurable email notification system to the existing admin, without touching booking, payment, partner or CMS logic.

## Where it lives

Everything goes into the existing **System Settings** page (`/admin/settings`), replacing today's single "Email Configuration" tab with three tabs:

- **Notifications** — one card per event: enable/disable, To, CC (add/remove chips, per event), Reply-To, subject, HTML body.
- **Test Email** — pick an event, pick a real booking (or use sample data), enter a recipient, send a one-off test that is never counted as a real notification.
- **Logs** — table of every send attempt: event, recipient, subject, status (sent/failed/skipped), error message, timestamp, related booking; filter by status/event, retry a failed one.

No new CMS, no changes to existing CMS content sections. The existing general/pricing/notifications tabs stay as-is.

## Events wired up

Only existing, already-successful application events. Each fires after the operation has completed and is dispatched fire-and-forget:

| Event | Existing trigger point |
|---|---|
| order_placed | booking saved (save-booking) |
| order_confirmed | shipment manifested with partner (create-consumer-shipment / business-create-shipment / assisted finalize) |
| order_failed_rejected | shipment creation failed / rejected by partner |
| order_cancelled | cancel-order flows |
| order_refunded | razorpay-refund success |
| order_completed | status change to delivered |
| status_change | important tracking status transitions |

## Safety rules

- Sending is always fire-and-forget (`EdgeRuntime.waitUntil`) and wrapped in try/catch; a failed email is logged and never rolls back, blocks, or alters the original operation.
- Duplicate prevention: a unique key of `(booking_id, event)` in the log table — a second attempt for the same event on the same booking is recorded as `skipped: duplicate` and not sent.
- SMTP credentials live only in server-side secrets and are read only inside the edge function. The admin UI never receives or displays them; it only shows sender name/address and a connection-status indicator.

## Technical details

**Database (new tables only):**
- `email_templates` — `event_key` (unique), `enabled`, `to_recipients[]`, `cc_recipients[]`, `reply_to`, `subject`, `body_html`, `updated_by`. Seeded with the events above and default ViaSetu-branded templates.
- `email_logs` — `event_key`, `booking_id`, `to_email`, `cc`, `subject`, `status` (`sent`/`failed`/`skipped`), `error`, `provider_response`, `is_test`, `created_at`; partial unique index on `(booking_id, event_key)` where `is_test = false and status = 'sent'`.
- Both get GRANTs + RLS: readable/writable only by admins via `is_super_admin` / `is_admin`; edge functions use the service role.

**Edge functions:**
- New `send-notification-email` — resolves the template for an event, renders variables (`{{order_id}}`, `{{awb}}`, `{{courier}}`, `{{amount}}`, `{{sender_name}}`, `{{receiver_name}}`, `{{status}}`, …), sends over SMTP with `denomailer`, writes the log row. Accepts `{ event, booking_id, override_to, is_test }`.
- New `email-smtp-test` capability folded into the same function via `is_test: true`.
- Existing `send-order-admin-email` stays untouched and keeps working; new calls are added alongside it, not in place of it.

**SMTP credentials:** Supabase's custom SMTP setting applies only to auth emails and is not readable from edge functions, so the same credentials must also be stored as project secrets (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). I will request these through the secure secret form — the values are never written into code or the database.

**Frontend:** only `src/pages/admin/SystemSettings.tsx` plus new components under `src/components/admin/email/`. No other page, hook, or business-logic file changes.
