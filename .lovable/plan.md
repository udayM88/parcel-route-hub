# Stage-based cancellation charges (MakeMyTrip-style)

## What the customer sees
1. Customer taps **Cancel Order**. A pop-up opens first: "Cancellation charges will apply" with the refund amount in large text and a **View details** link.
2. **View details** expands a breakdown:
   - Current stage of the order (e.g. "Label generated, awaiting pickup"), shown on a 3-step timeline with the active stage highlighted.
   - Amount paid
   - Courier charge (AWB/pickup cost)
   - ViaSetu cancellation fee
   - GST on the fee
   - **Refund amount** = Amount paid - total deduction
   - A one-line "How this is calculated" note and a link to the refund policy.
3. Customer picks a reason and confirms. The confirmation message shows the exact refund amount.

## Cancellation slabs (Hybrid)
| Stage | When | Courier part | ViaSetu part | Total deduction |
|---|---|---|---|---|
| 1. Grace | Within 30 min of booking, not picked up | ₹0 | ₹35 | ₹35 |
| 2. Pre-pickup | After 30 min, no rider assigned | ₹30 | ₹35 | ₹65 |
| 3. Pickup attempted | Out for pickup / rider assigned / pickup failed | ₹60 | ₹39 | ₹99 |
| After pickup | Picked up or later | Online cancel not allowed (existing support request flow) | | |

Rules:
- Deduction never exceeds amount paid; refund never goes below ₹0.
- Multi-box orders: fee is applied once per order (not per box).
- No deduction when the cancellation is not the customer's fault: courier failure, booking failure, admin cancellation, courier cancelling on its own. These keep the current 100% refund.
- Amounts are editable by super admins in Admin Settings, so numbers can change without code changes.

## Where it applies
- Consumer Order Details and History pages.
- Business portal shipments (same pop-up; wallet orders refunded to wallet minus deduction).
- Admin cancellations: admin chooses "Waive charges" or "Apply charges", default waive.

## Admin and reports
- Each cancelled order stores stage, deduction breakdown and refund amount; shown in Order Monitoring.
- CA report: cancellation fee recorded as ViaSetu income (excl. GST) with its GST; credit note equals the refunded amount only.
- Refund policy page updated with the slab table.

## Technical details
- New `cancellation_fee_settings` table (slabs, grace minutes, enabled flag) with admin-only write.
- New columns on `bookings`: `cancellation_stage`, `cancellation_fee`, `cancellation_fee_gst`, `refund_amount`.
- Shared `_shared/cancellation-fee.ts` computes the quote server-side from booking created_at, current normalized status and settings; a `cancellation-quote` function returns it to the pop-up. The UI never sends the amount.
- `_shared/refund.ts` accepts a partial amount (Razorpay `amount` in paise; wallet ledger partial credit). All six partner cancel functions recompute the quote at cancel time and pass the refund amount; only customer-initiated reasons apply fees.
- `CancelOrderDialog.tsx` rebuilt with summary + expandable breakdown + stage timeline; `useCancelOrder` fetches the quote on open.
- Booking financial adapter and CA report updated for the fee income line.
- Tests: one per slab, cap at amount paid, waiver for non-customer reasons, single fee for multi-box.
- Note: wallet payments are still paused; wallet partial refunds ship but stay unused until the wallet safety migration is approved.
