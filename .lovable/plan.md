# Server-side shipment creation + manual AWB entry

Two changes: make partner shipment creation happen on the server after payment (so a closed browser can't leave an order stuck), and let admins attach an AWB by hand to orders that were booked directly with a partner.

## 1. Shipment creation moves server-side

Today the browser verifies the payment, then calls the partner booking function itself. If the tab closes in between, the booking row stays at `PAYMENT_RECEIVED` with no AWB (exactly what happened to the 8 Aug order).

New flow:

```text
Razorpay success
  -> razorpay-verify-payment  (verifies signature, inserts PAYMENT_RECEIVED row)
       -> queues create-consumer-shipment in the background
            -> calls the right partner booking function
            -> writes AWB / tracking id / label / status CREATED
            -> on partner failure: marks FAILED + auto-refunds (existing logic)
  -> browser polls the booking row and shows the result
```

- New edge function `create-consumer-shipment`, modelled on the existing business shipment function: takes a booking id, picks the partner function from `partner_id` / `courier_name`, books, and persists the result with the service role.
- `razorpay-verify-payment` fires it in the background so the response to the browser is not delayed.
- Idempotent: if the row already has an AWB, or another run is in progress, it does nothing. Safe to retry.
- The browser no longer books directly; the review screen polls the booking until it reaches `CREATED` or `FAILED`, showing the same success and refund messages as today. If the user closes the tab, the order still completes and appears in History.
- Sweeper: a scheduled run every few minutes picks up rows stuck at `PAYMENT_RECEIVED` for more than 15 minutes with no AWB, retries once, and flags them for admin review if they still fail. Refunds stay a deliberate admin action rather than automatic.

## 2. Manual AWB entry for pending orders

For orders booked directly on a partner's own portal, admins get an "Add AWB manually" action on pending / failed orders in Order Monitoring and Assisted Bookings.

The dialog asks for:
- Courier partner (Delhivery, XpressBees, Shadowfax, Urbanebolt, Shree Maruti)
- AWB / tracking number
- Optional partner order id and label URL
- Optional note explaining why it was booked manually

On save the order becomes a normal live order: status `CREATED`, AWB and partner recorded, and it disappears from the pending list.

Everything downstream keeps working because the record looks the same as an API-created one:
- Live tracking pulls from that partner's tracking function using the AWB
- Label download works when the partner exposes a label API; otherwise the manually supplied label URL is used
- Cancellation, order details, invoices and the customer's History page all behave normally
- The order is tagged as manually entered so it can be told apart in reporting

## Technical notes

- New edge functions: `create-consumer-shipment` (service role, invoked by `razorpay-verify-payment` and by the sweeper) and `admin-attach-manual-awb` (Supabase JWT + `admin_users` role check, same pattern as `admin-finalize-assisted-booking`).
- Partner routing reuses the existing `pickPartnerFn` mapping; the frontend already resolves tracking/label functions via `src/lib/partner-functions.ts`, so setting `partner_id` to `<partner>_direct` is enough for those features to light up.
- Manual entries set `booking_source: 'manual_<partner>'` and record the admin email plus note in the failure/notes fields already on `bookings`; no schema change expected. If a dedicated flag is preferred over reusing existing columns, that would be one small migration adding `manual_awb_entry` metadata.
- `src/pages/Booking.tsx`'s per-partner booking blocks are replaced by a single poll-and-report step, which removes a large amount of duplicated client code.
- Sweeper runs via a pg_cron job hitting the retry endpoint.
