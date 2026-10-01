import { dispatchEmail } from "../_shared/notify-email.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { refundBookingIfPaid } from "../_shared/refund.ts";
import { readGatewayError, shreeMarutiGatewayFetch } from "../_shared/shree-maruti-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment, x-prayog-auth, x-internal-key",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const env = getEnvironmentFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "").trim();
    if (!bookingId) return json({ success: false, error: "booking_id is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: booking, error: bookingError } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (bookingError || !booking) return json({ success: false, error: "Booking not found" }, 404);

    const provided = req.headers.get("x-internal-key") || "";
    let authorized = serviceKey !== "" && provided === serviceKey;
    const prayog = req.headers.get("x-prayog-auth");
    if (!authorized && prayog) {
      try { authorized = JSON.parse(prayog)?.user_id === booking.user_id; } catch { authorized = false; }
    }
    if (!authorized) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data } = await authClient.auth.getUser();
        if (data?.user?.id === booking.user_id) authorized = true;
        else if (data?.user?.id) {
          const { data: adminRow } = await admin.from("admin_users").select("id").eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
          authorized = Boolean(adminRow);
        }
      }
    }
    if (!authorized) return json({ success: false, error: "Unauthorized" }, 401);

    const upstreamOrderId = String(body?.order_id || booking.prayog_order_id || "").trim();
    if (!upstreamOrderId) return json({ success: false, error: "Innofulfill order ID is missing; AWB cannot be used for cancellation" }, 400);
    const reason = String(body?.cancel_remarks || "Cancelled By Customer").trim().slice(0, 255);

    const res = await shreeMarutiGatewayFetch(env, "/gateway/booking-service/orders/cancel/bulk", {
      method: "POST", body: JSON.stringify({ orders: [{ orderId: upstreamOrderId, reason }] }),
    }, { retryTemporary: true });
    const parsed = await readGatewayError(res);
    const inner = parsed.data?.data ?? parsed.data;
    const cancelledIds = Array.isArray(inner?.orderIds) ? inner.orderIds.map(String) : [];
    const cancelled = Number(inner?.cancelledCount) > 0 || cancelledIds.includes(upstreamOrderId);
    if (!res.ok || !cancelled) {
      return json({ success: false, error: parsed.message, trace_id: parsed.traceId, partner_response: parsed.data }, res.status >= 400 ? res.status : 502);
    }

    const { error: updateError } = await admin.from("bookings").update({
      status: "CANCELLED", refund_reason: reason, updated_at: new Date().toISOString(),
    }).eq("id", bookingId);
    if (updateError) return json({ success: false, error: "Courier cancelled the order, but ViaSetu could not save the status", details: updateError.message }, 500);

    const refund = await refundBookingIfPaid(admin, bookingId, env, reason);
    dispatchEmail("order_cancelled", bookingId);
    return json({ success: true, message: "Order cancelled", order_id: upstreamOrderId, refund, trace_id: parsed.traceId });
  } catch (err) {
    console.error("[shree-maruti-cancel] error", String(err));
    return json({ success: false, error: "Shree Maruti cancellation request failed", details: String(err) }, 500);
  }
});