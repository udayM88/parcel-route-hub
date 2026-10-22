import { prepareCancellationQuote, refundCancelledBooking } from "../_shared/refund.ts";
import { dispatchSms } from "../_shared/notify-sms.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";
// Delhivery cancellation via /api/p/edit (cancellation: true)
// Triggers Razorpay refund if a payment was collected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isWalletPayment, refundWalletBooking } from "../_shared/wallet.ts";
import {
  getDelhiveryConfig,
  getEnvironmentFromRequest,
  getRazorpayConfig,
} from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  let reqBody: any = {};
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    reqBody = await req.clone().json().catch(() => ({}));
    const env = getEnvironmentFromRequest(req);
    const { apiBaseUrl, token } = getDelhiveryConfig(env);

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Delhivery token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { waybill, awb, booking_id, cancel_remarks } = reqBody;
    const trackId = waybill || awb;
    if (!trackId) {
      return new Response(
        JSON.stringify({ success: false, error: "waybill (AWB) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = { waybill: trackId, cancellation: "true" };
    const url = `${apiBaseUrl}/api/p/edit`;

    console.log("[delhivery-cancel] cancelling AWB:", trackId, "reason:", cancel_remarks);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let result: any;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }
    console.log("[delhivery-cancel] response:", text.slice(0, 800));

    if (!res.ok || result?.status === false || result?.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error || result?.remarks || "Failed to cancel order",
          details: result,
        }),
        { status: res.status >= 400 ? res.status : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update booking + refund (if payment collected)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (booking_id) {
      const { data: bookingData } = await supabase
        .from("bookings")
        .select("payment_id, payment_status")
        .eq("id", booking_id)
        .single();
      const cancelQuote = await prepareCancellationQuote(supabase, req, booking_id, reqBody);

      await supabase
        .from("bookings")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", booking_id);

      dispatchEmail("order_cancelled", booking_id);
      dispatchSms("ORDER_CANCELLED", booking_id);

      if (bookingData?.payment_status === "paid") {
        const r = await refundCancelledBooking(supabase, req, booking_id, env, String(cancel_remarks || "Cancelled By Customer"), reqBody, cancelQuote);
        console.log("[delhivery-cancel] refund outcome:", JSON.stringify(r));
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Order cancelled", details: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[delhivery-cancel] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
