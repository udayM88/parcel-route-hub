import { dispatchEmail } from "../_shared/notify-email.ts";
// Server-side safety net: refund a captured Razorpay payment with retry.
// Called by the client whenever a booking cannot be created after payment.
// Centralizes refund + audit-row insert so the browser closing mid-flow
// cannot leave money captured without a refund.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-prayog-auth, x-environment",
};

interface RefundAndRecordRequest {
  payment_id: string;
  amount?: number;            // rupees; full refund if omitted
  reason?: string;            // short reason code (e.g. 'shadowfax_failed')
  error_detail?: string;      // free-form details
  booking_row?: Record<string, unknown>; // optional FAILED row to insert
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller via Prayog auth (same convention as save-booking).
    const prayogAuthHeader = req.headers.get("x-prayog-auth");
    if (!prayogAuthHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let userId: string;
    try {
      const auth = JSON.parse(prayogAuthHeader);
      userId = auth.user_id;
      if (!userId) throw new Error("Missing user_id");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RefundAndRecordRequest;
    const { payment_id, amount, reason, error_detail, booking_row } = body || {};

    if (!payment_id) {
      return new Response(JSON.stringify({ error: "payment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = getEnvironmentFromRequest(req);
    const razorpayConfig = getRazorpayConfig(env);
    if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
      return new Response(
        JSON.stringify({ error: `Razorpay not configured for ${env}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: if we already finalized a row for this payment_id, return it.
    const { data: existing } = await supabase
      .from("bookings")
      .select("*")
      .eq("payment_id", payment_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && (existing.payment_status === "refunded" || existing.payment_status === "refund_failed")) {
      console.log("[confirm-booking-or-refund] idempotent hit:", payment_id);
      return new Response(
        JSON.stringify({
          refunded: existing.payment_status === "refunded",
          refund_id: existing.refund_id,
          booking: existing,
          idempotent: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // AUTO-REFUNDS DISABLED: refunds are issued manually by staff only after the
    // customer contacts Customer Care. We only record the failure here.
    const refundData: any = null;
    const lastErr: any = null;
    void sleep;
    const refunded = !!refundData;
    const paymentStatus = refunded ? "refunded" : "paid";

    let bookingRecord: any = existing || null;

    // Build a user-friendly failure reason for the History UI.
    const friendlyReason = (() => "Booking could not be completed. For your refund, please contact ViaSetu Customer Care at +91 94068 33147.")();
    const failureStep = (() => {
      const r = (reason || "").toLowerCase();
      if (r.includes("payment")) return "payment";
      if (r.includes("cancel")) return "cancel";
      return "manifest";
    })();

    // Raw partner error (kept verbatim for admin diagnostics, truncated to 2000 chars).
    const partnerErrorRaw = error_detail
      ? String(error_detail).slice(0, 2000)
      : null;

    if (existing) {
      // A row already exists (PAYMENT_RECEIVED row from verify-payment, or
      // a previous attempt). Mark it FAILED + refund details.
      const { data: updated, error: updateErr } = await supabase
        .from("bookings")
        .update({
          status: "FAILED",
          payment_status: paymentStatus,
          refund_id: refundData?.id || null,
          refund_reason: "manual_refund_pending_customer_care",
          failure_reason: friendlyReason,
          failure_step: failureStep,
          partner_error_raw: partnerErrorRaw,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateErr) {
        console.error("[confirm-booking-or-refund] FAILED row update error:", updateErr);
      } else {
        bookingRecord = updated;
      }
    } else if (booking_row && typeof booking_row === "object") {
      // No row yet — insert a fresh FAILED audit row.
      const failedRow = {
        ...booking_row,
        user_id: userId,
        payment_id,
        status: "FAILED",
        payment_status: paymentStatus,
        refund_id: refundData?.id || null,
        refund_reason: reason || "booking_failed_after_payment",
        failure_reason: friendlyReason,
        failure_step: failureStep,
        partner_error_raw: partnerErrorRaw,
      };
      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert(failedRow)
        .select()
        .single();
      if (insertErr) {
        console.error("[confirm-booking-or-refund] FAILED row insert error:", insertErr);
      } else {
        bookingRecord = inserted;
      }
    }

    if (refunded && bookingRecord?.id) {
      dispatchEmail("order_refunded", bookingRecord.id, {
        refund_reason: reason || "booking_failed_after_payment",
      });
    }

    return new Response(
      JSON.stringify({
        refunded,
        refund_id: refundData?.id || null,
        refund_status: refundData?.status || null,
        booking: bookingRecord,
        manual_refund: true,
        error: null,
        message: "No automatic refund. Customer must contact Customer Care for a refund.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[confirm-booking-or-refund] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
