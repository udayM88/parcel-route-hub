# Business Portal Upgrades + Pincode & Address Improvements

## 1. Business dashboard: shipment overview

Expand `/viasetuforbusinesses/dashboard` with a richer overview:

- Status tiles across the top: Total Shipments, In Transit, Out for Delivery, Delivered, Cancelled/RTO, plus existing Boxes Shipped and Total Spend.
- Status buckets reuse the shared `bucketOfStatus` helper already used by the admin dashboard, so a business sees the same normalised statuses as ops.
- Clicking a tile filters the list below.

## 2. Business shipment list (admin-style)

Below the tiles, replace the simple "Recent Shipments" table with a monitoring-style list modelled on the admin Order Monitoring page, scoped to the logged-in business only:

- Search by AWB / receiver name / pincode, plus status tabs.
- Columns: date, AWB, destination, courier, boxes, amount (GST inclusive), status badge.
- Row click opens a detail dialog: sender/receiver, per-box list with AWB, weight and label download, courier and delivery time, and the amount breakdown (shipping + GST). No internal margin fields shown.
- Live updates via the existing realtime table hook.

## 3. Pincode handling parity + swap button

- Business booking Step 1 pincodes use the same Google-backed lookup as consumer booking (`google-geocode-pincode` edge function), auto-resolving city/state as the user types a valid 6-digit pincode and showing them under each field.
- Resolved city/state pre-fill the address step so the business user doesn't retype them.
- Add a swap button between pickup and delivery pincodes that reverses them in one click, and clears stale rate quotes. Same swap control added to the consumer booking pincode section (Step 2).

## 4. Google address search in business address step

Replace the plain Address inputs for sender and receiver in the business booking address step with the existing `AddressAutocomplete` component (Google Places autocomplete + place details), same as consumer booking. Selecting a suggestion fills address, city and state; the pincode from Step 1 stays authoritative, and a warning appears if the selected address pincode differs.

## 5. Consent / declaration step for business booking

Insert a declaration step before payment in the business flow, reusing the consumer `DisclaimerStep` content (no prohibited or unauthorised shipments, accurate contents, authorised to ship, facilitator notice). Payment stays disabled until the checkbox is accepted. Business wizard becomes: Shipment → Courier → Addresses → Declaration → Pay.

## Technical notes

- Files touched: `src/pages/business/BusinessDashboard.tsx`, `src/pages/business/BusinessBooking.tsx`, `src/components/booking/BookingStep2.tsx`, plus a small shared `PincodeSwap`/route component and a business shipment detail dialog component.
- Reuse existing modules: `src/lib/booking-status.ts`, `src/hooks/usePincodeCity.ts`, `src/hooks/useRealtimeTable.ts`, `src/components/booking/AddressAutocomplete.tsx`, `src/components/booking/DisclaimerStep.tsx`.
- Box details for the detail dialog come from the existing `booking_boxes` table filtered by booking id; business rows already scope by `business_account_id`.
- No pricing changes: displayed amounts stay margin-inclusive with GST added on top, internal margin never surfaced.
- No database migration expected; if the `booking_boxes` read for business users is blocked by row-level access, a read policy scoped to the owning business account will be added.
