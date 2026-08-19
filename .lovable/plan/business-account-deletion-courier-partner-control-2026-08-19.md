# Business account deletion + courier partner control

Two additions to the admin area: safely delete a business account with a recorded reason, and a place to enable/disable courier partners.

## 1. Delete a business account (Manage Businesses)

- Each row gets a "Delete" action that opens a confirmation dialog.
- The dialog has a required reason dropdown:
  - Duplicate account
  - Business closed / no longer shipping
  - Fraud or misuse
  - KYC documents invalid or expired
  - Requested by the business
  - Non-payment / dispute
  - Other (free-text note becomes required)
- Optional internal note field, plus a "type the company name to confirm" guard.
- On confirm: login is revoked immediately (auth user disabled and unlinked), the account is marked deleted with the reason, deleted-by admin, and timestamp. Past shipments and invoices stay intact for audit and GST records.
- Deleted accounts are hidden from the default list; a "Show deleted" toggle reveals them with a "Deleted" badge and the reason on hover.
- Business portal login for that account stops working immediately.

## 2. Manage courier partners

- New admin page "Courier Partners" (`/admin/partners`), super admin + operations.
- Lists the five integrated partners (Delhivery, Shree Maruti, XpressBees, Shadowfax, UrbaneBolt) with logo, integration type (live API vs rate card) and an Enable/Disable switch.
- Optional short "disabled reason" note shown to admins only.
- A disabled partner is skipped everywhere: consumer booking serviceability, business booking, and assisted booking. It never appears in quotes.
- Guard: the last enabled partner cannot be disabled (would leave no couriers bookable).
- Existing in-flight shipments with that partner are unaffected; tracking, labels, and cancellation keep working.

## Technical notes

- Migration on `business_accounts`: add `deleted_at timestamptz`, `deletion_reason text`, `deletion_note text`, `deleted_by uuid`, `deleted_by_email text`. Existing status/is_active flags stay as they are.
- New edge function `delete-business-user`: verifies caller is an active `super_admin`/`operations` admin (same pattern as `create-business-user`), then via service role bans the auth user, clears `user_id`, sets `is_active=false`, `status='deleted'`, and stores the reason fields.
- `src/pages/admin/BusinessManagement.tsx`: add the delete dialog (shadcn `AlertDialog` + `Select`), the "Show deleted" filter, and the deleted badge; keep the realtime refresh.
- Partner toggles stored in `system_settings` under a new key `courier_partners`: `{ delhivery: { enabled, note }, ... }` — no new table, matches the existing settings pattern.
- New `src/pages/admin/PartnerManagement.tsx` + route in `src/App.tsx` + nav item in `AdminLayout.tsx`.
- Enforcement:
  - Client fan-out lists in `src/components/booking/BookingStep2.tsx` and `src/pages/business/BusinessBooking.tsx` filter `DIRECT_PARTNERS` by the setting.
  - Server-side guard in each `*-serviceability` edge function via a shared helper that reads `system_settings.courier_partners` and returns `is_serviceable: false` for a disabled partner, so a stale client cannot bypass the toggle.
  - Assisted booking partner picker in `src/pages/admin/AssistedBooking.tsx` filters the same way.
- Serviceability rules unchanged: no fallbacks, explicit partner flags only.
