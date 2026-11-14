# ViaSetu B2B tiered pricing

## Goal
Replace only business pricing with courier freight plus a volume-tiered booking fee and progressive weight fee. Consumer pricing, courier integrations, tracking, existing payment workflows and manual-refund policy remain unchanged.

## Confirmed pricing
- Starter: previous-month completed shipments 0–49; ₹10 booking fee.
- Growth: 50–200; ₹8 booking fee.
- Business: 201–1,000; ₹6 booking fee.
- Enterprise: 1,001+; approved customer-specific rate card required.
- Progressive fees per 500g for the bands first 500g / above 500g–2kg / above 2–5kg / above 5–10kg / above 10–25kg:
  - Starter: ₹20 / ₹15 / ₹10 / ₹6.25 / ₹3.75.
  - Growth: ₹17 / ₹12.50 / ₹8.75 / ₹5 / ₹3.
  - Business: ₹14 / ₹10 / ₹7.50 / ₹4.25 / ₹2.50.
- **Your clarification:** Growth uses the listed slab rates, not the conflicting example totals. Correct Growth platform fees at 5/10/15/20/25kg are ₹115/₹165/₹195/₹225/₹255.
- Above 25kg requires approved heavy-shipment pricing or an approved custom quote; no silent fallback.

## What will change
### Business quotations and checkout
- Apply the new pricing independently to each eligible, enabled courier/service using existing freight responses.
- Use server-calculated quotes for the booking screen, rate calculator and merchant API; remove the current consumer-price-plus-₹15 business formula.
- Calculate courier-specific chargeable weights without replacing actual parcel weights. Round the platform-fee weight upward to 500g.
- Charge the fixed booking fee once per order. For multi-package orders, derive each package's billed weight using the configured courier contract, then calculate the progressive fee on the shipment's combined billed weight unless that contract explicitly requires separate package treatment. Store the allocation for box-level records.
- Show the final payable price and GST before payment. Never disclose freight procurement rates or internal profit figures to businesses.
- Save an immutable quote and booking pricing snapshot; checkout, payment verification, finalization and any enabled wallet debit use that same amount, not a new rate lookup.
- Expired unaccepted quotes require a fresh quote. Accepted prepared bookings retain their snapshot through the existing payment window; no historical repricing.

### Business dashboard and Pricing & Tiers
- Show current tier, previous-month qualifying volume, this-month completed volume, next-tier progress and booking fee.
- Add tier comparison, progressive-weight charges and a shipment cost estimate using the existing courier quote flow.
- Retain shipment history, invoices and monthly expenditure, excluding abandoned/unpaid checkout drafts from spend.
- Enterprise/heavy shipments without an approved card show a custom-pricing requirement and cannot proceed to payment.

### Admin B2B Pricing Management
- Add threshold, fixed-fee and weight-band editing, enabled/disabled rules, effective dates and draft preview before publishing.
- Support approved Enterprise/heavy/customer-specific cards, contract validity and effective-dated tier overrides with optional expiry.
- Show pricing versions, staff audit history and platform-fee revenue excluding GST; old orders retain saved charges.
- Restrict pricing publication and overrides to verified super admins; other existing staff roles do not gain new pricing permissions.

### Monthly classification and tax
- Freeze each month's tier using the previous calendar month's completed shipments in Asia/Kolkata, recalculating on the first day with an idempotent scheduled job and a server-side catch-up if the job was missed.
- Default new/zero-volume accounts to Starter. Count a multi-package booking once when it is completed, not once per box. Prefer recorded delivery events for completion dates; flag missing historical delivery evidence rather than inventing dates.
- Configure freight tax treatment and service-fee GST separately. Existing Delhivery quotes already expose pre-tax freight; do not extract or add freight GST twice. Validate other enabled partners' saved tax evidence before enabling their new pricing configuration.
- Preserve the existing 18% GST and place-of-supply handling. Missing tax/contract configuration blocks that quote with a clear explanation rather than guessing.

## Technical scope
### Additive database changes
Proposed new protected tables:
- `b2b_pricing_versions`: effective dates, approval/publication state, enabled rules and tax settings.
- `b2b_pricing_tiers` and `b2b_pricing_slabs`: versioned thresholds, booking fees and progressive rates.
- `b2b_customer_rate_cards`: negotiated Enterprise/heavy/customer rates, approval and contract dates.
- `b2b_tier_overrides` and `b2b_monthly_tiers`: effective-dated staff overrides and frozen monthly qualifying counts.
- `b2b_courier_pricing_rules`: partner/service volumetric divisor, billing minimum/increments, package aggregation and freight-tax treatment.
- `b2b_quotes`: business-scoped finalized quotes, expiry, request fingerprint and immutable private pricing evidence.
- `b2b_pricing_audit_logs`: append-only staff changes and publication history.
- Add protected pricing snapshot storage linked to `bookings` and box allocations linked to `booking_boxes`, without rewriting existing rows. Customer responses expose only safe price/tax/weight fields; private freight-cost snapshots remain server/admin-only.

Every new table gets explicit grants and tenant/admin access policies. No existing table, payment, wallet movement or historical invoice is deleted or recalculated.

### Affected application areas
- Shared B2B calculation and quote helpers under `supabase/functions/_shared`, using integer paise and integer weight increments for decimal-safe calculations.
- `business-create-shipment`, `merchant-api`, business quote/configuration endpoints and the monthly tier job.
- Pricing-only integration points in `razorpay-create-order`, `razorpay-verify-payment`, `create-consumer-shipment` and assisted business booking, preserving their existing sequencing and courier calls.
- `src/lib/pricing.ts`: preserve B2C functions; replace business-only callers with finalized server quotes.
- `BusinessBooking`, rate-calculator/activated rate-card views, `BusinessDashboard`, business analytics/invoices, admin navigation and the new pricing management page.
- Existing saved-order financial adapter and invoice/export readers use new snapshots where available and keep their current historical fallback otherwise.
- Record the finalized architecture in `AGENTS.md` and release/verification status in `PROJECT_CONTEXT.md`.

## Safety and verification
- Tests for all six tier boundaries, all supplied platform-fee examples with corrected Growth values, weight boundaries/rounding, volumetric rules and multi-package allocation.
- Tests for approved/expired/missing Enterprise and heavy cards, overrides, effective dates, disabled rules, GST-inclusive/exclusive freight and snapshot preservation.
- Payment/booking amount equality, idempotent consumption/debits, cancellation/manual-refund invariants and B2C regression tests.
- Exercise business quotes through preparation and invoice readback, admin draft/preview/publication, and desktop/mobile pages without creating unsolicited live shipments or charges.
- Keep wallet shipment creation paused; this pricing project does not authorize removing the existing safety gate.
- Authenticated end-to-end verification is unavailable through managed sessions for this externally connected Supabase project; report any checks that require the owner's live session or a real approved payment instead of claiming them tested.
- Publish new pricing only after schema, partner tax/weight configuration and targeted tests pass; source updates alone must not be presented as a verified live-payment release.

## Completion report
Provide the schema changes, calculation helper, admin configuration, dashboard updates, test results and any remaining partner-contract/tax or authenticated-payment verification dependencies.