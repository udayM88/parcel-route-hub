import { prepareCancellationQuote, refundCancelledBooking } from "../_shared/refund.ts";
import { dispatchSms } from "../_shared/notify-sms.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getEnvironmentFromRequest, getPrayogConfig, getRazorpayConfig } from "../_shared/environment.ts";
import { isWalletPayment, refundWalletBooking } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  let reqBody: any = {};
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    reqBody = await req.clone().json().catch(() => ({}));
    const env = getEnvironmentFromRequest(req);
    const prayogConfig = getPrayogConfig(env);

    const { order_id, auth_token, booking_id } = reqBody;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!auth_token) {
      return new Response(
        JSON.stringify({ error: "auth_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[prayog-cancel] Cancelling order ${order_id}, env: ${env}`);

    // Call Prayog cancel API
    const response = await fetch(
      `${prayogConfig.apiBaseUrl}/gateway/booking-service/orders/${order_id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth_token}`,
          "tenantId": prayogConfig.tenantId || "",
        },
      }
    );

    const responseText = await response.text();
    console.log(`[prayog-cancel] Response status: ${response.status}, body: ${responseText}`);

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: result?.message || "Failed to cancel order", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking status in DB
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

      // Auto-refund if payment was collected
      if (bookingData?.payment_status === "paid") {
        const r = await refundCancelledBooking(supabase, req, booking_id, env, "Cancelled By Customer", reqBody, cancelQuote);
        console.log("[prayog-cancel] refund outcome:", JSON.stringify(r));
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Order cancelled successfully", details: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[prayog-cancel] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
