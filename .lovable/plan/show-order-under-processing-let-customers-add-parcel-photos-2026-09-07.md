# Show "Order under processing" + let customers add parcel photos later

## Why

Some bookings do not get an AWB from the courier the moment payment succeeds. Payment is captured and the order is saved, but the courier confirmation happens seconds to minutes later (or is retried in the background, as with the Delhivery pickup-address delay). Today those orders sit in the list with an unclear label and no AWB, so the customer cannot tell whether their booking worked.

Separately, parcel photos can only be added from the order detail screen. Customers who skip the step at booking time have no obvious way back to it.

## What will change

### 1. "Under processing" state
- Any paid order that does not yet have a tracking number (AWB) will show a clear amber **Processing** badge with the line "We're confirming your booking with the courier. Your tracking number will appear here shortly."
- This appears in three places: the confirmation screen right after payment, the order list in History, and the order detail page.
- While an order is in this state, the app quietly re-checks it every 15 seconds (and when the screen regains focus) so the tracking number and courier status appear on their own, without the customer refreshing.
- A manual "Check again" action is available on the order card and detail page.
- If the order ultimately fails and is refunded, the existing failure message and refund note continue to show as they do today — no change there.

### 2. Add parcel photos after booking
- Each order card in History gets an "Add parcel photos" action that opens the existing photo uploader for that shipment (same 5-photo limit, same compression, same secure storage).
- Available for orders that are placed and not yet delivered/cancelled; if photos already exist, the button reads "Parcel photos (n)" and shows the current ones with the option to add or remove.
- Uses the existing upload service exactly as the order detail page already does — no new storage or permissions.

## Technical notes

- Processing state = booking row with `payment_status` in paid/settled and no `prayog_awb`/`tracking_id`, and `status` not in the terminal set (FAILED, CANCELLED, refunded states). Statuses seen in production for this case: `PAYMENT_RECEIVED`, `PENDING`, `BOOKING_RETRY`.
- Add a small shared helper (e.g. `src/lib/order-status.ts`) exporting `isProcessingOrder(booking)` and a display-status resolver, reused by `History.tsx`, `OrderDetails.tsx` and `BookingConfirmationDialog.tsx` so the three screens cannot drift.
- `get-user-orders` already returns `_booking` with `status`, `payment_status`, `prayog_awb`, `tracking_id`, `failure_reason` — enough for the check; no edge-function change needed. Polling re-invokes `get-user-orders` (History) / the existing detail fetch (OrderDetails), stopping once an AWB arrives or after ~5 minutes.
- Photos: reuse `ParcelPhotoUpload` inside a dialog on the History card, keyed by `_booking.id`. The `parcel-photos` edge function already authorises the owner by `booking.user_id` for list/upload/delete and enforces limits; no backend change required.

## Out of scope

- No change to pricing, courier integrations, retry logic, refunds, SMS notifications, or admin screens.
