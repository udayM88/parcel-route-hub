# Consumer pricing: 100% margin + ₹25 platform fee

## What changes

Consumer (non-business) shipments only. Business pricing (₹15 flat) stays exactly as-is.

Old: `total = rate × 1.70 × 1.18`
New: `total = (rate × 2.00 + 25) × 1.18`

Example on a ₹100 courier rate: today ₹201, after the change ₹265.50 → ₹266.

The ₹25 is added before GST (so it is taxable) and is never shown to the customer — the customer keeps seeing a single all-inclusive price with the retail strike-through and savings badge as today.

## Where admins see the fee

Every consumer order stores the ₹25 separately so it can be reported on:

- Order Monitoring — pricing breakdown gets a "Platform fee (flat)" line alongside partner payable, margin and GST.
- Revenue Management — flat fee shown per order and totalled; taxable-value math updated so the fee isn't double counted.
- Analytics — flat-fee revenue included in platform revenue totals.
- Accounts export (CSV/GST sheets) — new column plus updated column notes.

Orders placed before this change show ₹0 for the flat fee line; their existing totals and margins are untouched.

## Technical notes

- `src/lib/pricing.ts` is the single source of truth: set `CONSUMER_MARGIN_PCT` to `1.00`, add `CONSUMER_PLATFORM_FEE = 25`, and update `computeConsumerPrice` to `round((rate × (1 + margin) + 25) × 1.18)`. All consumer call sites (`computeBaseFare` in Booking, ETACard, SmartRanking, PartnerComparisonTable, BookingStep2/5) inherit the new number with no edits.
- `computePriceBreakdown` gains a `flatPlatformFee` field; `margin` stays total-margin-over-rate so existing consumers of it keep working.
- `supabase/functions/calculate-platform-fee/index.ts` duplicates the markup math — update its `MARKUP_PCT`/`ZONE_FEE` constants to match (2.00 markup expressed as 1.00 margin + ₹25 pre-GST) so admin-assisted quotes agree with the app.
- New nullable numeric column `consumer_platform_fee` on `public.bookings` (default `0`, GRANTs unchanged since the table already exists). Written from `src/pages/Booking.tsx` in every insert path (paid, assisted, payment-link, unpaid) and passed through `supabase/functions/_shared/booking-draft.ts`, `admin-create-unpaid-booking`, `admin-create-payment-link`.
- Admin read paths add the column to their select lists: `OrderMonitoring.tsx`, `RevenueManagement.tsx`, `Analytics.tsx`, `src/lib/accounts-export.ts`.
- Balance-due / re-price flows (`booking_balance_payments`) recompute using the same helper, so adjusted prices follow the new formula automatically.

## Verification

- Sanity-check a live quote (411001 → 462022, 250 g): Delhivery Surface ₹35 pre-GST → consumer total `(35 × 2 + 25) × 1.18 = ₹112`.
- Confirm the booking review screen shows only the all-inclusive total (no ₹25 line), and Order Monitoring shows the ₹25 for the new order.
