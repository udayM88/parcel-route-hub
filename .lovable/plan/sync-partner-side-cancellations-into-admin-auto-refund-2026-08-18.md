# Sync partner-side cancellations into admin + auto-refund

## Problem

When an order is cancelled in the app, the flow already works: the partner cancel function marks the booking `CANCELLED`, sends the cancellation email, and fires a Razorpay refund.

The gap is cancellations that happen outside the app — the customer or the courier cancels on the partner portal. The status refresh job does pick the new partner status up, but it only writes whatever text the partner returned (e.g. "Cancelled", "Pickup Cancelled") to the booking. It does not normalise the status, does not initiate a refund, and does not send the cancellation email. So in the admin Order Monitoring section the order can look active-ish and the customer never gets money back automatically.

Also, the sync only runs when an admin opens Order Monitoring (manual refresh + 5-minute poll while the page is open). Nothing runs in the background, so a cancellation on the partner side sits undetected until someone opens that page.

## What will change

1. **Cancellation detected from partner tracking is treated as a real cancellation.**
   When the refreshed partner status falls in the "cancelled" bucket (cancelled, pickup cancelled, order cancelled, etc.), the booking is written as `CANCELLED` (normalised, not raw partner text), with the raw partner wording kept as the cancellation reason for audit.

2. **Auto-refund initiation.**
   If that booking has a captured payment (`payment_status = 'paid'` and a `payment_id`), a full Razorpay refund is initiated automatically, exactly like the in-app cancel path does. The refund id is stored and `payment_status` moves to `refunded`, or `refund_failed` if Razorpay rejects it. Bookings already refunded, unpaid, or admin-assisted/no-payment are skipped — the refund is only ever attempted once per booking.

3. **Cancellation email.**
   The existing `order_cancelled` notification fires for these externally-detected cancellations, so the customer is told the order is cancelled and the refund is on its way.

4. **Background sync so admin doesn't have to be watching.**
   A scheduled job runs the status refresh every 15 minutes (same pattern as the existing 5-minute pending-shipment retry cron), so partner-side cancellations and other status moves land in the admin section on their own. The manual Refresh button keeps working unchanged.

5. **Admin visibility.**
   Cancelled orders show the refund state in Order Monitoring (Refund initiated / Refunded / Refund failed) so the team can spot the ones that need manual follow-up.

## Technical notes

- `supabase/functions/admin-refresh-order-statuses/index.ts`: after computing `bucketOfStatus(newStatus)`, add a `cancelled` branch that writes `status: 'CANCELLED'`, `failure_reason`/`refund_reason` = raw partner status, dispatches `order_cancelled`, and calls the shared refund path.
- Refund logic is currently duplicated inside each `*-cancel-order` function. Extract it into `supabase/functions/_shared/refund.ts` (`refundBookingIfPaid(supabase, bookingId, env)`), guarded so it no-ops when `payment_status !== 'paid'` or `refund_id` is already set, and writes `refund_id`, `refund_reason`, `payment_status`. The refresh job and the partner cancel functions both use it.
- The function needs a service-role invocation path for the cron (currently it hard-requires an admin bearer token). Allow the service-role key as an alternative caller identity, keeping the admin check for browser calls.
- Cron: add a `pg_cron` job (`sync-order-statuses-15min`) posting to `admin-refresh-order-statuses` with the service-role header and `x-environment: production`, mirroring job 1.
- Admin UI: `src/pages/admin/OrderMonitoring.tsx` — surface `payment_status` refund states in the booking row/detail for cancelled orders.

No schema change is required — `refund_id`, `refund_reason`, `payment_status`, and `status` already exist on `bookings`.
