# Business shipment detail: cancel + full history parity

Bring the business shipment detail dialog up to the same level as the consumer order history / order details screens, and add self-service cancellation.

## What gets added to the shipment detail dialog

1. **Cancel shipment**
   - A "Cancel shipment" button, shown only while the shipment status is still cancellable (created / booked / confirmed / manifested-not-picked states).
   - Opens the same cancellation dialog used in the admin section (reason dropdown: Cancelled By Customer, Incorrect/Incomplete contact info, Payment Issue).
   - Routes to the correct courier's cancel function based on the booking's partner (Delhivery, XpressBees, UrbaneBolt, Shadowfax, Shree Maruti), updates status to CANCELLED and triggers the automatic Razorpay refund the existing cancel functions already perform.
   - If the courier refuses because the parcel has already moved (manifested / picked up / in transit), the user sees the friendly explanation and is directed to support instead of a raw API error.
   - Multi-box note: cancelling cancels the master shipment. Where a partner cancels per-AWB, each box AWB on the booking is cancelled in turn and the result reported per box.

2. **Refund / payment status**
   - A status strip in the dialog showing Paid / Refund initiated / Refunded / Refund failed, matching the consumer order page.

3. **Download invoice**
   - Same GST invoice output as the consumer order page (ViaSetu branding, sender/receiver, box list, shipping + GST breakdown), opened in a new tab for print/save.

4. **Repeat shipment**
   - "Repeat" button that opens the business booking flow prefilled with the same pincodes, box count, weights/dimensions and addresses.

5. **Detail completeness**
   - Show goods type, declared value, pickup/delivery full addresses with contact names and phones, courier service and promised delivery time, and per-box chargeable weight — all in the dialog, alongside the existing per-box Track and Label buttons and support block.

## Technical notes

- Dashboard query must also select `booking_source`, `prayog_awb`, `payment_status`, `refund_id`, `shipment_value`, `length/width/height`, `package_weight` — `booking_source` is required for cancel routing and is not currently fetched.
- Reuse `useCancelOrder` / `isCancellable` and `CancelOrderDialog`; no new cancel logic.
- The existing dispute fallback (`raise-cancellation-dispute`) authenticates with the consumer `x-prayog-auth` header, which business users do not have. For business cancellations that the courier rejects, we skip the dispute call and instead show the "contact support" message with a prefilled support email (same support block already in the dialog). Adding real dispute support for business users would need a backend auth change and is out of scope unless you want it.
- Cancel needs the booking row updated by the edge functions (service role), so no RLS change is required; the dashboard already receives realtime updates and will reflect the new CANCELLED status automatically.
- All new UI stays inside `src/pages/business/BusinessDashboard.tsx` plus a small invoice helper shared with the consumer implementation.
