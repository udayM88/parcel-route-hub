// Shared revenue-recognition rules so every admin surface agrees on
// what counts as collected cash vs. what is excluded.
//
// A booking only contributes to "Total Collections", "Platform Revenue"
// and "Amount Payable to Partners" when the customer's money is actually
// sitting with us. That means:
//   ✓ payment_status = 'paid'  (or legacy NULL on very old rows)
//   ✗ 'cop_pending'    — cash not yet collected from sender
//   ✗ 'refunded'       — money returned to customer
//   ✗ 'refund_failed'  — refund attempted; not real revenue either
//   ✗ 'failed'         — payment never captured

export type PaymentStatus = string | null | undefined;

const EXCLUDED = new Set([
  "cop_pending",
  "refunded",
  "refund_failed",
  "failed",
  "external_settled", // admin-created booking; customer paid outside ViaSetu
]);

export function isCollected(payment_status: PaymentStatus): boolean {
  if (!payment_status) return true; // legacy rows pre-payment_status
  return !EXCLUDED.has(payment_status);
}

export function isCopPending(payment_status: PaymentStatus): boolean {
  return payment_status === "cop_pending";
}

export function isRefunded(payment_status: PaymentStatus): boolean {
  return payment_status === "refunded" || payment_status === "refund_failed";
}

// Rows that never became a real booking: the customer opened checkout and
// walked away (PAYMENT_ABANDONED), or the pre-checkout placeholder row is
// still waiting for payment (PENDING_PAYMENT). These must never appear in
// admin order lists, revenue totals or analytics.
const NON_BOOKED_STATUSES = new Set(["payment_abandoned", "pending_payment"]);

export function isBookedOrder(
  status: string | null | undefined,
  payment_status?: PaymentStatus,
): boolean {
  if (status && NON_BOOKED_STATUSES.has(status.toLowerCase())) return false;
  // 'pending' payment = checkout never completed (admin COP/unpaid bookings
  // use 'cop_pending' / 'external_settled', which stay visible).
  if (payment_status === "pending") return false;
  return true;
}

