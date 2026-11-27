// A failed booking can be retried only when the customer has paid, no AWB exists
// and no refund has been issued — so a retry can never double-book or book a refunded order.
export function retryBlockReason(b: Record<string, any>): string | null {
  if (b.prayog_awb || b.tracking_id) return "This booking already has an AWB.";
  if (b.refund_id || String(b.payment_status) === "refunded") return "This payment was refunded, so the booking cannot be retried.";
  if (!["paid", "external_settled"].includes(String(b.payment_status))) return "Payment is not settled for this booking.";
  const s = String(b.status || "").toUpperCase();
  if (!["PAYMENT_RECEIVED", "FAILED", "BOOKING_RETRY"].includes(s)) return `Bookings with status ${s} cannot be retried.`;
  return null;
}
