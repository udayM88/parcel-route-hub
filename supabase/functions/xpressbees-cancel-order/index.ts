import { prepareCancellationQuote, refundCancelledBooking } from "../_shared/refund.ts";
import { dispatchSms } from "../_shared/notify-sms.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";
// XpressBees cancellation — POST /api/shipments2/cancel  with { awb }.
// Updates booking row + auto-refund via Razorpay if payment was collected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";
import { xpressbeesFetch } from "../_shared/xpressbees-auth.ts";
import { isWalletPayment, refundWalletBooking } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  let reqBody: any = {};
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    reqBody = await req.clone().json().catch(() => ({}));
    const env = getEnvironmentFromRequest(req);
    const { waybill, awb, booking_id, cancel_remarks } = reqBody;
    const trackId = waybill || awb;
    if (!trackId) {
      return new Response(JSON.stringify({ success: false, error: "waybill (AWB) is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per franchise_apidoc: POST /api/franchise/shipments/cancel_shipment with { awb_number }
    const payload = { awb_number: String(trackId) };
    console.log("[xpressbees-cancel] payload:", JSON.stringify(payload));

    const res = await xpressbeesFetch(env, "/api/franchise/shipments/cancel_shipment", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let result: any;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }
    console.log("[xpressbees-cancel] response:", res.status, text.slice(0, 800));

    const success = res.ok && (result?.response === true || result?.status === true);
    if (!success) {
      return new Response(JSON.stringify({
        success: false,
        error: result?.message || result?.error || "Failed to cancel order",
        details: result,
      }), { status: res.status >= 400 ? res.status : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
        console.log("[xpressbees-cancel] refund outcome:", JSON.stringify(r));
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Order cancelled", details: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[xpressbees-cancel] error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
