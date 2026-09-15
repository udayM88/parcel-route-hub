# Monthly Billing and GST Reconciliation

## Goal
Upgrade **Admin → Payment Reconciliation** into a one-click monthly accounts report covering booked, cancelled, failed, refunded, and unmatched payments, with an Excel workbook suitable for review by the CA.

## Confirmed accounting choices
- Show refunds as **separate credit notes**, not by rewriting the original sale.
- Assign sales by the **actual payment-capture date** and credit notes by the **actual refund date**.
- Produce the **full CA workbook**.
- Put uncertain historical records in an **Exceptions** sheet without guessing or changing stored amounts.
- Keep ViaSetu’s registered place of supply as **Maharashtra**: Maharashtra shipments split GST into CGST/SGST; other states use IGST.

## What exists today
- Payment Reconciliation already compares captured Razorpay payments with bookings and identifies matched, orphan, failed, and refunded payments.
- Revenue Management already exports an Excel workbook with order, monthly, courier-partner, GST, and metadata sheets.
- Historical booking rows contain the core stored billing fields. The audit found one stored amount mismatch and some refund-status rows without a saved refund ID, so exceptions must be visible rather than silently inferred.
- The current export groups by booking date and does not use actual Razorpay refund dates, include credit-note sheets, or combine payment reconciliation with the billing workbook.

## Implementation

### 1. Add month and custom-date reporting controls
- Add a month picker, custom From/To dates, and quick presets to Payment Reconciliation.
- Use Indian Standard Time boundaries consistently.
- Add one primary action: **Generate CA Excel Report**.
- Keep the existing payment reconciliation and refund actions available.

### 2. Build one authoritative report dataset
- Extend the existing admin-only Razorpay reconciliation function instead of creating a second payment integration.
- Page through all relevant Razorpay captures and refunds for the selected period.
- Join them to bookings by payment ID and include booking, courier, parcel, customer, pricing, tax, cancellation, and refund details.
- Include refunds made during the selected month even when the original sale occurred in an earlier month.
- Use stored historical amounts as booked; never apply today’s pricing rules to old orders.
- Include external/manual/COP records only when their accounting evidence is sufficient; otherwise place them in Exceptions.
- Use shipment status events for cancellation timing where available. Mark older cancellations without a reliable event timestamp as exceptions instead of inventing a date.
- Keep abandoned and incomplete checkout rows out of sales totals.

### 3. Apply auditable GST and credit-note rules
- Treat stored GST as the source amount for each historical sale.
- Split GST into CGST/SGST or IGST from the sender/place-of-supply state rule.
- For full refunds, reverse taxable value and GST in the credit-note register.
- For partial refunds, reverse values proportionally and preserve the Razorpay refund amount/reference.
- Reconcile, per transaction:
  - captured amount versus booking total;
  - taxable value + GST + applicable add-ons versus charged total;
  - refunded amount versus credit-note value;
  - net collections after refunds.
- Never include orphan, failed-payment, pending-payment, or uncertain records in GST totals until classified; list them clearly for review.

### 4. Generate a CA-ready Excel workbook
Create a professionally formatted workbook with formulas, frozen headers, filters, INR/date formats, and these sheets:

1. **Executive Summary** — gross sales, taxable value, CGST, SGST, IGST, refunds, net GST, net collections, and order counts by status.
2. **Sales Register** — one line per captured/booked transaction using payment date.
3. **Credit Notes** — one line per full or partial refund using refund date and original payment/order references.
4. **Order Status** — placed, confirmed, in transit, delivered, cancelled, returned, failed, and processing counts/details.
5. **Payment Reconciliation** — matched, orphan, failed, refunded, external/manual, and difference columns.
6. **GST Summary** — gross tax, reversals, and net CGST/SGST/IGST payable.
7. **Courier Summary** — order count, gross collections, partner payable, ViaSetu revenue, refunds, and net amounts by partner.
8. **Exceptions** — missing payment/refund references, split mismatches, unreliable historical dates, and records requiring CA review.
9. **Report Notes** — period, IST generation time, accounting rules, data sources, and definitions.

### 5. Preserve compatibility and verify old data
- Reuse the existing accounts export and shared revenue/status helpers, consolidating duplicated financial calculations into one shared report model.
- Keep current booking, payment, refund, OTP, courier, and customer flows unchanged.
- Validate the workbook against database totals and Razorpay totals for sample months, including an earlier month with refunds.
- Recalculate workbook formulas and verify zero formula errors before completion.
- Verify month selection, custom ranges, empty months, large historical ranges, mobile admin layout, and admin-only access.

## Technical details
- No destructive historical backfill is planned. Accurate historical payment/refund dates come from Razorpay; stored booking values remain unchanged.
- The report endpoint will validate dates, enforce active-admin access, use bounded pagination, and return explicit source/exception markers.
- If Razorpay is temporarily unavailable, report generation will fail clearly rather than producing incomplete tax totals.
- Existing balance-payment records will be included in the report model for future adjustments; the current database has no such rows yet.
