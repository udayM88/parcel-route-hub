# Assisted booking with multiple boxes

## Goal
Make multiple-box shipments work end to end in Assisted Booking, for both payment-link bookings and bookings created without ViaSetu payment.

## Changes
- Preserve all entered boxes when an assisted booking is created.
- Create one parcel record per box, including its weight, dimensions, allocated courier rate, and price.
- After payment, send the assisted booking through the existing multi-parcel shipment flow instead of the legacy single-parcel call.
- For no-payment assisted bookings, save the same parcel records before optional courier manifesting.
- Generate and retain a separate AWB, tracking reference, and shipping label for every accepted box.
- Keep existing per-box failure and partial-refund behavior for payment-link bookings; no refund is attempted for externally settled bookings.
- Return a clear parcel count and multi-box result to the assisted-booking screens.

## Verification
- Check single-box assisted bookings remain unchanged.
- Check 2–10 boxes survive both assisted creation paths.
- Check each box is booked independently and receives its own AWB/label.
- Check retries do not duplicate parcel records or courier bookings.
- Check the project build and relevant function logic.

## Technical details
Reuse the existing `booking_boxes`, shared box normalization/persistence helper, and `create-consumer-shipment` multi-parcel engine. No database schema or pricing changes are required.
