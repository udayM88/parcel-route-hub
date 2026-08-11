// Shadowfax Reverse Pickup — Cancel
// Doc: POST /api/v2/clients/requests/mark_cancel
// Allowed cancel_remarks: "Cancelled By Customer", "Incorrect/ Incomplete contact info", "Payment Issue"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getEnvironmentFromRequest, getShadowfaxConfig, getRazorpayConfig } from "../_shared/environment.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};

const ALLOWED_REMARKS = [
  "Cancelled By Customer",
  "Incorrect/ Incomplete contact info",
  "Payment Issue",
];

function normalizeRemark(input?: string): string {
  if (!input) return "Cancelled By Customer";
  const exact = ALLOWED_REMARKS.find((r) => r.toLowerCase() === input.toLowerCase());
  if (exact) return exact;
  const lower = input.toLowerCase();
  if (lower.includes("contact") || lower.includes("address") || lower.includes("incomplete")) {
    return "Incorrect/ Incomplete contact info";
  }
  if (lower.includes("payment") || lower.includes("refund")) return "Payment Issue";
  return "Cancelled By Customer";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const sfxConfig = getShadowfaxConfig(env);

    if (!sfxConfig.token) {
      return new Response(
        JSON.stringify({ error: "Shadowfax API token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { client_order_id, awb, cancel_remarks, booking_id } = await req.json();
    // Prefer AWB / client_request_id; fall back to client_order_id for backward compat.
    const requestId = awb || client_order_id;

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "awb or client_order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const remarks = normalizeRemark(cancel_remarks);
    console.log(`[shadowfax-cancel] Cancelling request_id=${requestId} reason="${remarks}"`);

    const response = await fetch(
      `${sfxConfig.apiBaseUrl}/api/v2/clients/requests/mark_cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${sfxConfig.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_id: requestId, cancel_remarks: remarks }),
      },
    );

    const result = await response.json().catch(() => ({}));
    console.log("[shadowfax-cancel] Response:", JSON.stringify(result));

    const apiOk = response.ok && (result?.responseCode === 200 || result?.responseCode === undefined);

    if (!apiOk) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.responseMsg || result?.message || "Failed to cancel order",
          details: result,
        }),
        { status: response.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update booking + auto-refund (unchanged)
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
        .update({ status: "CANCELLED", refund_reason: remarks, updated_at: new Date().toISOString() })
        .eq("id", booking_id);

      dispatchEmail("order_cancelled", booking_id);

      if (bookingData?.payment_id && bookingData?.payment_status === "paid") {
        try {
          console.log(`[shadowfax-cancel] Initiating refund for payment ${bookingData.payment_id}`);
          const razorpayConfig = getRazorpayConfig(env);
          const authHeader = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);

          const refundResp = await fetch(
            `https://api.razorpay.com/v1/payments/${bookingData.payment_id}/refund`,
            {
              method: "POST",
              headers: { Authorization: `Basic ${authHeader}`, "Content-Type": "application/json" },
              body: JSON.stringify({ speed: "normal" }),
            },
          );

          const refundResult = await refundResp.json();
          if (refundResp.ok) {
            await supabase.from("bookings").update({ payment_status: "refunded" }).eq("id", booking_id);
            console.log(`[shadowfax-cancel] Refund initiated: ${refundResult.id}`);
          } else {
            await supabase.from("bookings").update({ payment_status: "refund_failed" }).eq("id", booking_id);
            console.error(`[shadowfax-cancel] Refund failed:`, refundResult);
          }
        } catch (refundErr) {
          console.error("[shadowfax-cancel] Refund error:", refundErr);
          await supabase.from("bookings").update({ payment_status: "refund_failed" }).eq("id", booking_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: result?.responseMsg || "Order cancelled successfully", details: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[shadowfax-cancel] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
