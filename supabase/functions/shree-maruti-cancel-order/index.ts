// Shree Maruti cancellation.
// PUT /fulfillment/public/seller/order/cancel-order  { orderId, cancelReason }
// Updates booking row + auto-refund via Razorpay if payment was collected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";
import { shreeMarutiFetch } from "../_shared/shree-maruti-auth.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const { waybill, awb, order_id, booking_id, cancel_remarks } = await req.json();

    // Look up the upstream orderId (preferred per docs). Fall back to AWB.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let upstreamOrderId: string | null = order_id || null;
    let bookingRow: any = null;
    if (booking_id) {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", booking_id)
        .single();
      bookingRow = data || null;
      if (!upstreamOrderId) {
        upstreamOrderId =
          bookingRow?.prayog_order_id ||
          bookingRow?.tracking_id ||
          bookingRow?.prayog_awb ||
          null;
      }
    }
    const trackId = upstreamOrderId || waybill || awb;
    if (!trackId) {
      return new Response(JSON.stringify({ success: false, error: "order_id or waybill is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      orderId: String(trackId),
      cancelReason: cancel_remarks || "Cancelled By Customer",
    };
    console.log("[shree-maruti-cancel] payload:", JSON.stringify(payload));

    const res = await shreeMarutiFetch(
      env,
      "/fulfillment/public/seller/order/cancel-order",
      { method: "PUT", body: JSON.stringify(payload) },
    );
    const text = await res.text();
    let result: any;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }
    console.log("[shree-maruti-cancel] response:", res.status, text.slice(0, 800));

    if (!res.ok || result?.success === false || result?.status === false) {
      return new Response(JSON.stringify({
        success: false,
        error: result?.error || result?.message || "Failed to cancel order",
        details: result,
      }), { status: res.status >= 400 ? res.status : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update booking + refund
    if (booking_id) {
      const paymentId = bookingRow?.payment_id;
      const paymentStatus = bookingRow?.payment_status;

      await supabase
        .from("bookings")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", booking_id);

      dispatchEmail("order_cancelled", booking_id);

      if (paymentId && paymentStatus === "paid") {
        try {
          const rz = getRazorpayConfig(env);
          const auth = btoa(`${rz.keyId}:${rz.keySecret}`);
          const refundResp = await fetch(
            `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
            {
              method: "POST",
              headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
              body: JSON.stringify({ speed: "normal" }),
            },
          );
          const refundResult = await refundResp.json();
          if (refundResp.ok) {
            await supabase
              .from("bookings")
              .update({ payment_status: "refunded", refund_id: refundResult.id || null })
              .eq("id", booking_id);
            console.log("[shree-maruti-cancel] refund initiated:", refundResult.id);
          } else {
            await supabase.from("bookings").update({ payment_status: "refund_failed" }).eq("id", booking_id);
            console.error("[shree-maruti-cancel] refund failed:", refundResult);
          }
        } catch (refundErr) {
          console.error("[shree-maruti-cancel] refund error:", refundErr);
          await supabase.from("bookings").update({ payment_status: "refund_failed" }).eq("id", booking_id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Order cancelled", details: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[shree-maruti-cancel] error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
