import { dispatchEmail } from "../_shared/notify-email.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getEnvironmentFromRequest, getPrayogConfig, getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const env = getEnvironmentFromRequest(req);
    const prayogConfig = getPrayogConfig(env);

    const { order_id, auth_token, booking_id } = await req.json();

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

      await supabase
        .from("bookings")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", booking_id);

      dispatchEmail("order_cancelled", booking_id);

      // Auto-refund if payment was collected
      if (bookingData?.payment_id && bookingData?.payment_status === "paid") {
        try {
          console.log(`[prayog-cancel] Initiating refund for payment ${bookingData.payment_id}`);
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
            }
          );

          const refundResult = await refundResp.json();
          if (refundResp.ok) {
            await supabase
              .from("bookings")
              .update({ payment_status: "refunded" })
              .eq("id", booking_id);
            console.log(`[prayog-cancel] Refund initiated: ${refundResult.id}`);
          } else {
            await supabase
              .from("bookings")
              .update({ payment_status: "refund_failed" })
              .eq("id", booking_id);
            console.error(`[prayog-cancel] Refund failed:`, refundResult);
          }
        } catch (refundErr) {
          console.error("[prayog-cancel] Refund error:", refundErr);
          await supabase
            .from("bookings")
            .update({ payment_status: "refund_failed" })
            .eq("id", booking_id);
        }
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
