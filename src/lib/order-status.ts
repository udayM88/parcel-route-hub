// Shared helpers for the "order under processing" state.
//
// Some bookings are paid and saved before the courier returns an AWB — the
// manifest happens server-side (and is retried) moments later. Until the AWB
// lands, every customer-facing screen should say the order is being confirmed
// instead of showing a raw/stale internal status.

export interface OrderStatusInput {
  status?: string | null;
  payment_status?: string | null;
  awb?: string | null;
  prayog_awb?: string | null;
  tracking_id?: string | null;
}

const TERMINAL_STATUSES = [
  "FAILED",
  "CANCELLED",
  "CANCELED",
  "DELIVERED",
  "RTO",
  "PAYMENT_ABANDONED",
  "PENDING_PAYMENT",
  "DUPLICATE_PAYMENT_REVIEW",
];

const PAID_STATUSES = ["paid", "external_settled", "cop_pending", "partially_refunded"];

export const PROCESSING_LABEL = "Processing";
export const PROCESSING_MESSAGE =
  "We're confirming your booking with the courier. Your tracking number will appear here shortly.";

export function getOrderAwb(b?: OrderStatusInput | null): string {
  if (!b) return "";
  return String(b.awb || b.prayog_awb || b.tracking_id || "").trim();
}

/**
 * True when the payment went through but the courier hasn't confirmed the
 * shipment yet (no AWB, non-terminal status).
 */
export function isProcessingOrder(b?: OrderStatusInput | null): boolean {
  if (!b) return false;
  if (getOrderAwb(b)) return false;
  const status = String(b.status || "").toUpperCase();
  if (TERMINAL_STATUSES.includes(status)) return false;
  const paymentStatus = String(b.payment_status || "").toLowerCase();
  return PAID_STATUSES.includes(paymentStatus);
}

/**
 * Status text to show the customer. Processing wins over any raw status,
 * then terminal DB statuses (the courier feed can stay stale), then the
 * courier/API status.
 */
export function resolveDisplayStatus(
  apiStatus?: string | null,
  booking?: OrderStatusInput | null,
): string {
  if (isProcessingOrder(booking)) return PROCESSING_LABEL;
  const dbStatus = booking?.status || "";
  if (dbStatus && TERMINAL_STATUSES.includes(dbStatus.toUpperCase())) return dbStatus;
  return apiStatus || dbStatus || "Unknown";
}
