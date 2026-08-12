# Assisted booking without payment + manual AWB / label upload

Two additions for admin-assisted bookings:

1. Admins can complete an assisted booking without collecting payment through ViaSetu (customer already paid elsewhere, or payment is settled offline).
2. Admins can attach or replace the courier partner, AWB and a shipping label file on any booking — including uploading a label PDF/image instead of pasting a URL — and the customer sees it in History.

## 1. Bypass payment in Assisted Booking

On the final step of the assisted flow (where today the only action is "Send payment link"), a second action appears: **Book without payment**.

Clicking it opens a short confirmation asking for a reason (e.g. "Paid to other partner", "Offline settlement", "Goodwill / reship") plus an optional note, then creates the booking immediately:

- Order is created for the same customer with the selected courier and price.
- Payment is recorded as settled outside ViaSetu, not as a ViaSetu collection, so revenue and reconciliation totals are not inflated.
- The order is tagged as admin-created-without-payment, with the admin's email, reason and note stored for audit.
- Two outcomes offered at confirm time:
  - **Book with the courier now** — the partner API is called server-side and the AWB/label come back automatically (same path as a paid assisted booking).
  - **Create order only** — no partner call; the order sits as pending manifest so the admin can attach an AWB from a partner portal booking (section 2).
- The customer sees the order in History right away, with no payment due prompt.

## 2. Manual AWB, courier partner and label upload

The existing "Add AWB manually" dialog is extended:

- Works on any order that needs it, not just ones with no AWB. If an AWB already exists, the dialog shows it and asks the admin to confirm replacing it (used when a partner fails to fulfil and the parcel is re-booked with a different courier). The previous AWB and partner are kept in the order's audit trail.
- Courier partner can be changed as part of the same action, so the order moves to the new partner cleanly.
- Label: admin can either paste a URL (as today) or **upload a PDF / PNG / JPG label file**. Uploaded labels are stored privately and served to admin and to the owning customer through a signed link.
- Optional partner order ID and internal note stay as they are.

Available from Assisted Bookings and Order Monitoring, same as today.

## 3. What the customer sees

In History and Order Details, once an AWB is attached the order behaves like any normal order:

- Live tracking through the new partner's tracking integration
- Download label (uploaded file or partner API label)
- Cancellation, invoice, repeat shipment, support — all unchanged
- Orders booked without payment show no outstanding-payment state; nothing exposes internal reasons or notes

## Technical notes

- New edge function `admin-create-unpaid-booking` (Supabase JWT + `admin_users` role check, mirroring `admin-create-payment-link`): inserts the booking with `is_admin_assisted: true`, `booking_source: 'admin_assisted_unpaid'`, `payment_status: 'external_settled'`, `status: 'PAYMENT_RECEIVED'`, and admin/reason metadata; then optionally invokes `create-consumer-shipment` server-side so a closed tab can't strand the order.
- `src/lib/revenue.ts` — add `external_settled` to the excluded set so these orders don't count as collected cash; surface them separately where the COP-pending tile already exists in admin reporting.
- `src/pages/Booking.tsx` assisted branch: add the "Book without payment" action beside the payment-link CTA, wired to the new function, reusing the existing `bookingDraft` object.
- `admin-attach-manual-awb`: remove the 409 on an existing AWB, gate replacement on an explicit `replace: true` flag, append prior AWB/partner into the audit string, and accept an uploaded label path.
- New private storage bucket `shipping-labels` with RLS: admins full access; customers read only labels for their own bookings (via a signed URL issued by an edge function). `ManualAwbDialog.tsx` gets a file input that uploads before submitting.
- No schema migration expected — existing `bookings` columns (`payment_status`, `booking_source`, `label_url`, `partner_id`, `partner_error_raw`, `created_by_admin_email`) cover it. Only the storage bucket + its policies are new.
