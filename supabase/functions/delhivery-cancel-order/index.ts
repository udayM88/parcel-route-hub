import { dispatchSms } from "../_shared/notify-sms.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";
// Delhivery cancellation via /api/p/edit (cancellation: true)
// Triggers Razorpay refund if a payment was collected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const env = getEnvironmentFromRequest(req);
    const { apiBaseUrl, token } = getDelhiveryConfig(env);

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Delhivery token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { waybill, awb, booking_id, cancel_remarks } = await req.json();
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

      await supabase
        .from("bookings")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", booking_id);

      dispatchEmail("order_cancelled", booking_id);
      dispatchSms("ORDER_CANCELLED", booking_id);

      if (bookingData?.payment_id && bookingData?.payment_status === "paid") {
        try {
          const razorpayConfig = getRazorpayConfig(env);
          const authHeader = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);
          const refundResp = await fetch(
            `https://api.razorpay.com/v1/payments/${bookingData.payment_id}/refund`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ speed: "normal" }),
            },
          );
          const refundResult = await refundResp.json();
          if (refundResp.ok) {
            await supabase
              .from("bookings")
              .update({ payment_status: "refunded" })
              .eq("id", booking_id);
            console.log("[delhivery-cancel] refund initiated:", refundResult.id);
          } else {
            await supabase
              .from("bookings")
              .update({ payment_status: "refund_failed" })
              .eq("id", booking_id);
            console.error("[delhivery-cancel] refund failed:", refundResult);
          }
        } catch (refundErr) {
          console.error("[delhivery-cancel] refund error:", refundErr);
          await supabase
            .from("bookings")
            .update({ payment_status: "refund_failed" })
            .eq("id", booking_id);
        }
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
