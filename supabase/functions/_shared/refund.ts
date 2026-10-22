// Shared Razorpay refund helper for cancellation flows.
// Idempotent: no-ops when the booking is not paid or a refund already exists.
import { getRazorpayConfig, type Environment } from "./environment.ts";
import { isWalletPayment, refundWalletBooking } from "./wallet.ts";

export type RefundOutcome =
  | { status: "skipped"; reason: string }
  | { status: "refunded"; refundId: string }
  | { status: "failed"; error: string };

export async function refundBookingIfPaid(
  supabase: any,
  bookingId: string,
  env: Environment,
  reason?: string,
  amount?: number,
): Promise<RefundOutcome> {
  const partial = typeof amount === "number" && amount > 0 ? Math.round(amount * 100) / 100 : undefined;
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

  if (isWalletPayment(booking.payment_id)) {
    const wr = await refundWalletBooking(supabase, bookingId, partial, reason || "cancelled");
    if (!wr.ok) return { status: "failed", error: wr.error || "wallet refund failed" };
    await supabase.from("bookings").update({
      payment_status: "refunded", refund_id: "wallet", ...(reason ? { refund_reason: reason } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId);
    return { status: "refunded", refundId: "wallet" };
  }

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
        body: JSON.stringify(partial ? { speed: "normal", amount: Math.round(partial * 100) } : { speed: "normal" }),
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

// ---------------- Stage-based cancellation charges ----------------
import { computeCancellationQuote, mergeSettings, type CancellationQuote } from "./cancellation-fee.ts";
import { createClient as createAuthClient } from "npm:@supabase/supabase-js@2";

/** True only for server-to-server calls or a signed-in active admin. */
export async function isStaffRequest(req: Request, supabase: any): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceKey && req.headers.get("x-internal-key") === serviceKey) return true;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return false;
  try {
    const c = createAuthClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await c.auth.getUser();
    if (!data?.user?.id) return false;
    const { data: row } = await supabase.from("admin_users").select("id")
      .eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
    return Boolean(row);
  } catch { return false; }
}

export async function loadCancellationSettings(supabase: any) {
  const { data } = await supabase.from("system_settings").select("value").eq("key", "cancellation_fees").maybeSingle();
  return mergeSettings(data?.value);
}

/** Quote computed from the booking's state BEFORE it is marked cancelled. */
export async function quoteCancellation(supabase: any, bookingId: string, waived: boolean): Promise<CancellationQuote | null> {
  const { data: b } = await supabase.from("bookings")
    .select("courier_price, created_at, status, payment_status").eq("id", bookingId).maybeSingle();
  if (!b) return null;
  const settings = await loadCancellationSettings(supabase);
  const paid = b.payment_status === "paid" ? Number(b.courier_price) || 0 : 0;
  return computeCancellationQuote({ amountPaid: paid, createdAt: b.created_at, status: b.status, settings, waived });
}

/**
 * Cancellation refund: customer requests pay the stage fee; staff may waive
 * (body.waive_cancellation_fee). Stores the breakdown on the booking.
 */
export async function refundCancelledBooking(
  supabase: any, req: Request, bookingId: string, env: Environment, reason: string,
  body: any, preQuote?: CancellationQuote | null,
): Promise<RefundOutcome> {
  let quote = preQuote;
  if (quote === undefined) {
    const staff = await isStaffRequest(req, supabase);
    quote = await quoteCancellation(supabase, bookingId, staff && body?.waive_cancellation_fee !== false);
  }
  if (quote) {
    await supabase.from("bookings").update({
      cancellation_stage: quote.stage, cancellation_fee: quote.deduction,
      cancellation_fee_gst: quote.gstOnFee, refund_amount: quote.refundAmount,
    }).eq("id", bookingId);
  }
  if (quote && quote.deduction > 0 && quote.refundAmount <= 0) {
    return { status: "skipped", reason: "cancellation fee equals amount paid" };
  }
  return refundBookingIfPaid(supabase, bookingId, env, reason,
    quote && quote.deduction > 0 ? quote.refundAmount : undefined);
}

/** Helper for cancel functions: decide waiver up-front from the request. */
export async function prepareCancellationQuote(supabase: any, req: Request, bookingId: string, body: any) {
  const staff = await isStaffRequest(req, supabase);
  return quoteCancellation(supabase, bookingId, staff && body?.waive_cancellation_fee !== false);
}
