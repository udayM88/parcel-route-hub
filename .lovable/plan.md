# Collecting a price difference when an order is re-booked with another partner

When a partner (e.g. Shree Maruti) cannot fulfil an order and admin re-books it with a different courier, the new price may be higher than what the customer already paid. This adds a clean way to collect that shortfall.

## Behaviour

**Shortfall (new partner costs more)**
- While attaching the new courier / AWB, admin sees the old price, the new price and the difference.
- Admin picks one of three actions:
  - **Send payment link** — Razorpay link generated for the difference and shared with the customer (also stored on the order).
  - **Ask customer to pay in app** — a "Balance due" state appears on the order in History with a Pay button.
  - **Waive** — ViaSetu absorbs the difference; a reason is required and stored for audit.
- Both collection paths point at the same balance record, so paying either way closes it.

**Cheaper re-book** — no refund, no customer-facing change. The lower cost is simply recorded internally.

**When to book with the new partner** — admin chooses per order at the time of the action:
- *Book now* — shipment is created immediately, balance stays open and is collected afterwards.
- *Book after payment* — order waits in a "balance due" state; once the customer pays, the new partner shipment is created automatically.

## What the customer sees

In History and Order Details, an affected order shows a **Balance due** card with a plain breakdown:

```text
Original courier      Shree Maruti      ₹  420
Re-booked with        Delhivery         ₹  505
Already paid                            ₹ -420
Balance to pay                          ₹   85  (incl. GST)
```

A **Pay balance** button opens the normal Razorpay flow. On success the card turns into "Balance paid" and the order behaves like any other order (tracking, label, invoice, cancellation). Waived differences are invisible to the customer — the order just looks fully paid. No internal reasons or notes are exposed.

## Technical notes

- New table `public.booking_balance_payments`: `booking_id`, `reason`, `previous_courier_name`, `previous_amount`, `new_courier_name`, `new_amount`, `amount_due`, `status` (`pending` | `paid` | `waived`), `collection_mode` (`link` | `in_app`), `razorpay_payment_link_id`/`url`, `payment_id`, `waived_by`/`waive_reason`, `book_after_payment` boolean, admin audit fields, timestamps. Grants: `authenticated` select (own bookings via `booking_id`), `service_role` all; RLS so a customer only reads rows for their own booking, admins full access via `is_operations()`.
- Extend `admin-attach-manual-awb` to accept `new_price`, `difference_action` (`link` | `in_app` | `waive`), `waive_reason`, `book_after_payment`; it writes the balance row and, for the link mode, reuses the Razorpay payment-link logic from `admin-create-payment-link` (amount = difference only).
- New edge function `pay-booking-balance` (customer-facing, `x-prayog-auth`): creates a Razorpay order for the outstanding balance; verification handled by extending `razorpay-verify-payment` to recognise a `balance_id` in notes — it marks the balance paid and, when `book_after_payment` is true, fires the partner booking server-side (same `EdgeRuntime.waitUntil` path used today).
- `ManualAwbDialog.tsx`: add price-difference block (auto-computed vs `bookings.courier_price`), the three action buttons, waive-reason field, and the book-now / book-after-payment toggle.
- `History.tsx` + `OrderDetails.tsx`: fetch open balance rows for listed bookings and render the Balance due card and pay flow (reuses `PaymentModal`).
- `src/lib/revenue.ts`: count paid balance amounts as collected revenue; exclude waived amounts and record them as absorbed cost alongside the existing `external_settled` handling.
- Admin views (`OrderMonitoring`, `AssistedPendingBookings`) show a Balance-due badge and the outcome (paid / pending / waived).
