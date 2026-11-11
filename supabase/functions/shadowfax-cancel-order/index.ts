import { prepareCancellationQuote, refundCancelledBooking } from "../_shared/refund.ts";
import { dispatchSms } from "../_shared/notify-sms.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";
// Shadowfax Marketplace 360 — forward cancel. POST /api/v3/clients/orders/cancel/
// request_id = AWB (parent AWB for multi-box orders) or client_order_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getEnvironmentFromRequest, getShadowfaxConfig, getRazorpayConfig } from "../_shared/environment.ts";
import { isWalletPayment, refundWalletBooking } from "../_shared/wallet.ts";

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
  let reqBody: any = {};
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    reqBody = await req.clone().json().catch(() => ({}));
    const env = getEnvironmentFromRequest(req);
    const sfxConfig = getShadowfaxConfig(env);

    if (!sfxConfig.token) {
      return new Response(
        JSON.stringify({ error: "Shadowfax API token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { client_order_id, awb, cancel_remarks, booking_id } = reqBody;
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
      `${sfxConfig.apiBaseUrl}/api/v3/clients/orders/cancel/`,
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

    const code = Number(result?.responseCode ?? result?.response_code ?? 200);
    const msg = String(result?.responseMsg || result?.message || "").toLowerCase();
    const apiOk = response.ok && code >= 200 && code < 300 && !msg.includes("fail") && !msg.includes("not ");

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
      const cancelQuote = await prepareCancellationQuote(supabase, req, booking_id, reqBody);

      await supabase
        .from("bookings")
        .update({ status: "CANCELLED", refund_reason: remarks, updated_at: new Date().toISOString() })
        .eq("id", booking_id);

      dispatchEmail("order_cancelled", booking_id);
      dispatchSms("ORDER_CANCELLED", booking_id);

      if (bookingData?.payment_status === "paid") {
        const r = await refundCancelledBooking(supabase, req, booking_id, env, String(remarks || "Cancelled By Customer"), reqBody, cancelQuote);
        console.log("[shadowfax-cancel] refund outcome:", JSON.stringify(r));
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
