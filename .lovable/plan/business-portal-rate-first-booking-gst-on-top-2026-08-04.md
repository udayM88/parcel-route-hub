# Business Portal: Rate-First Booking + GST on Top

## 1. Hide the internal margin everywhere

The ₹15 per box is internal only. Remove every user-facing mention:

- Business dashboard: drop the "Business rate: courier price + ₹15 per box, all inclusive." line.
- Booking page: remove the "courier rate + ₹15 per box" caption above the courier list and the "₹15 per box" text in the page meta description.
- Summary card: replace the "Courier charges / ViaSetu fee" split with a clean breakdown:
  - Shipping charges (rate + margin, already merged, GST-exclusive)
  - GST (18%)
  - Total payable

## 2. Pricing: margin baked in, GST added on top

Current business price is `rate + 15` treated as all-inclusive (GST back-extracted). New rule:

```text
displayed net  = courier rate + 15   (internal margin, never labelled)
GST            = 18% of net
displayed rate = net + GST           (this is what the user always sees)
```

Every price shown in the business portal is the GST-inclusive figure. The courier list, summary, payment amount and the booking record all use this.

Both the frontend pricing helper and the `business-create-shipment` edge function are updated to the same formula so the charged amount and the stored booking totals match.

## 3. New shipment: rate-first flow

Replace the current "fill everything, then quote" page with a stepped flow matching the consumer booking experience:

**Step 1 – Shipment details (only this before rates)**
- Pickup pincode, delivery pincode
- Number of boxes, with weight and L/W/H per box
- Goods type and shipment value stay here (needed by partner APIs)
- Button: Get courier rates → runs serviceability/rate checks per box across all five partners and keeps only partner+service combos serviceable for every box

**Step 2 – Choose courier**
- List of couriers with GST-inclusive total, service name, ETA, box count
- No retail strike-through or savings badge (business accounts)

**Step 3 – Pickup & delivery details**
- Full sender and receiver name, phone, address, city, state (pincodes carried over and locked from step 1)
- Same validation as today (10-digit phone, 6-digit pincode)

**Step 4 – Review & pay**
- Shipping charges / GST / Total payable, then Razorpay
- On success, same per-box AWB + label result screen as today

A step indicator at the top lets the user go back; rates are re-fetched if pincodes or boxes change.

## Technical notes

- `src/lib/pricing.ts`: `computeBusinessPrice` becomes `round((rate + BUSINESS_FLAT_MARGIN) * 1.18)`; add a helper returning the net/GST/total triple for business shipments.
- `src/pages/business/BusinessBooking.tsx`: split into steps with local state; address fields render only at step 3.
- `src/pages/business/BusinessDashboard.tsx`: remove the pricing caption.
- `supabase/functions/business-create-shipment/index.ts`: per-box `price = round((rate + 15) * 1.18)`; `gst` computed as the added 18% rather than back-extracted; `base_fare` = net, `margin_amount` = total − courier rate.
