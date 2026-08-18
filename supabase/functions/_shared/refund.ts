// Shared Razorpay refund helper for cancellation flows.
// Idempotent: no-ops when the booking is not paid or a refund already exists.
import { getRazorpayConfig, type Environment } from "./environment.ts";

export type RefundOutcome =
  | { status: "skipped"; reason: string }
  | { status: "refunded"; refundId: string }
  | { status: "failed"; error: string };

export async function refundBookingIfPaid(
  supabase: any,
  bookingId: string,
  env: Environment,
  reason?: string,
): Promise<RefundOutcome> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("payment_id, payment_status, refund_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) return { status: "skipped", reason: error.message };
  if (!booking) return { status: "skipped", reason: "booking not found" };
  if (booking.refund_id) return { status: "skipped", reason: "already refunded" };
  if (booking.payment_status !== "paid") {
    return { status: "skipped", reason: `payment_status=${booking.payment_status ?? "none"}` };
  }
  if (!booking.payment_id) return { status: "skipped", reason: "no payment_id" };

  try {
    const cfg = getRazorpayConfig(env);
    if (!cfg.keyId || !cfg.keySecret) {
      return { status: "skipped", reason: `razorpay not configured for ${env}` };
    }
    const auth = btoa(`${cfg.keyId}:${cfg.keySecret}`);
    const resp = await fetch(
      `https://api.razorpay.com/v1/payments/${booking.payment_id}/refund`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ speed: "normal" }),
      },
    );
    const result = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("[refund] razorpay refund failed:", JSON.stringify(result).slice(0, 500));
      await supabase.from("bookings")
        .update({ payment_status: "refund_failed", updated_at: new Date().toISOString() })
        .eq("id", bookingId);
      return { status: "failed", error: result?.error?.description || `HTTP ${resp.status}` };
    }

    await supabase.from("bookings")
      .update({
        payment_status: "refunded",
        refund_id: result?.id || null,
        ...(reason ? { refund_reason: reason } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    console.log("[refund] refund initiated:", result?.id, "for booking", bookingId);
    return { status: "refunded", refundId: result?.id };
  } catch (e: any) {
    console.error("[refund] error:", e);
    await supabase.from("bookings")
      .update({ payment_status: "refund_failed", updated_at: new Date().toISOString() })
      .eq("id", bookingId);
    return { status: "failed", error: String(e?.message || e) };
  }
}
