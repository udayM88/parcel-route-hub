# Multi-parcel booking for consumers

Let a consumer ship up to 10 parcels to the same destination in one order with one courier, exactly like the business portal already does: one order, one payment, one AWB and one shipping label per parcel.

## What the customer sees

1. **Parcel details step** — a "Add another parcel" control (max 10). Each parcel row has its own weight and length/width/height. Parcel 1 stays exactly as today, so a single-parcel booking is unchanged.
2. **Rates** — every courier is priced per parcel (each parcel's own chargeable weight) and the sum is shown as the order total. Consumer pricing rules stay as they are: 100% margin on the courier rate + 18% GST, and the hidden ₹25 platform fee is charged **once per order**, not per parcel.
3. **Review & payment** — a per-parcel breakdown (weight, dimensions, price) plus the order total; one Razorpay payment for everything.
4. **Order details / History** — a "Parcels" list showing each parcel's AWB, status and a **Download label** button per parcel, plus tracking per AWB. A single-parcel order looks the same as today.
5. **Partial failure** — if the courier accepts some parcels and rejects others, the accepted parcels stay live and the amount for the rejected parcels is automatically refunded to the customer, with a clear message about which parcels were refunded.

## What admin sees

- Order Monitoring detail drawer gets the same per-parcel list: AWB, status, error (if any) and a per-parcel label download that re-fetches from the courier when the cached link has expired.
- Bulk "download all labels" for the order (opens each parcel's label).
- Revenue/analytics figures continue to use the order totals already stored on the booking row.

## Technical plan

**Data** — no schema change needed. `bookings.box_count` and the existing `booking_boxes` table (weight, dims, courier_rate, price, tracking_id, partner_order_id, label_url, status, error_message) already carry everything; they are currently only written by the business flow.

**Quoting** — extend the serviceability/rate path used by the consumer booking page to accept a parcel array: request rates per parcel weight for each partner, keep only partners serviceable for all parcels, and present the summed consumer price. Existing single-parcel behaviour is the 1-element case.

**Booking (server-side)** — generalise `create-consumer-shipment`:
- If the booking has `box_count > 1`, read its `booking_boxes` rows and call the partner booking function once per box (same per-box loop shape as `business-create-shipment`), each with its own `order_id`, weight and dimensions, so each parcel receives its own AWB and label from the partner API.
- Persist per-box `tracking_id`, `partner_order_id`, `label_url`, `status`, `error_message`.
- Roll up onto the booking row: first successful AWB into `tracking_id`/`prayog_awb`/`label_url`, `status = CREATED` when at least one box booked, `FAILED` only when all boxes fail.
- Partial failure → call `razorpay-refund` with the summed price of the failed boxes (it already supports partial amounts), record the refund id/reason, and send the existing rejection/refund notification with the failed parcel list. All-fail keeps today's full-refund path via `confirm-booking-or-refund`.
- Booking rows are created before payment (existing `PENDING_PAYMENT` flow); the box rows are written at the same time so the retry sweeper and admin retries work unchanged.

**Payload/response handling per partner** — each partner booking function already takes a single-parcel payload and returns `{ success, awbNumber, label_url }`; calling it N times is the only reliable way to get N AWBs across Delhivery, XpressBees, UrbaneBolt, Shadowfax and Shree Maruti, since none of them are wired for multi-piece manifests today. XpressBees' label comes back only in the create response, so it is stored per box at booking time.

**Labels** — extend `get-booking-label` to accept an optional `box_id`/`awb`: it validates ownership, checks the stored pre-signed link with the existing freshness logic, and re-fetches from the partner label function for that AWB when stale, persisting the refreshed URL on the box row. Admin screens reuse `isFreshLabelUrl` plus the partner label function per box.

**Tracking** — `get-booking-detail` returns the box rows; the consumer and admin tracking views iterate AWBs and render one timeline per parcel.

**Cancellation** — cancelling an order cancels each booked AWB at the partner and refunds the corresponding amounts, reusing the current cancel/refund functions per box.

## Out of scope

- Different destinations per parcel (all parcels share one sender/receiver, as in the business flow).
- Mixing couriers within one order.
