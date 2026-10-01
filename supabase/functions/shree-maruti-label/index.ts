// Shree Maruti label generation through the Innofulfill gateway v2.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import {
  getShreeMarutiGatewaySession,
  readGatewayError,
  shreeMarutiGatewayFetch,
} from "../_shared/shree-maruti-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment, x-internal-key",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function validPdf(bytes: Uint8Array): boolean {
  return bytes.length > 100 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const env = getEnvironmentFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "").trim();
    const boxId = String(body?.box_id || "").trim();
    let orderId = String(body?.order_id || "").trim();
    if (!bookingId && !boxId) return json({ success: false, error: "booking_id or box_id is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey);
    let target: "bookings" | "booking_boxes";
    let targetId: string;
    let ownerId: string | null = null;
    if (boxId) {
      const { data: box, error } = await admin.from("booking_boxes")
        .select("id,booking_id,partner_order_id").eq("id", boxId).maybeSingle();
      if (error || !box || (bookingId && box.booking_id !== bookingId)) return json({ success: false, error: "Parcel not found" }, 404);
      const { data: parent } = await admin.from("bookings").select("user_id").eq("id", box.booking_id).maybeSingle();
      ownerId = parent?.user_id || null;
      orderId = orderId || String(box.partner_order_id || "");
      target = "booking_boxes";
      targetId = box.id;
    } else {
      const { data: booking, error } = await admin.from("bookings")
        .select("id,prayog_order_id,user_id").eq("id", bookingId).maybeSingle();
      if (error || !booking) return json({ success: false, error: "Booking not found" }, 404);
      ownerId = booking.user_id || null;
      orderId = orderId || String(booking.prayog_order_id || "");
      target = "bookings";
      targetId = booking.id;
    }
    const provided = req.headers.get("x-internal-key") || "";
    let authorized = serviceKey !== "" && provided === serviceKey;
    if (!authorized) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const authClient = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data } = await authClient.auth.getUser();
        if (data?.user?.id === ownerId) authorized = true;
        else if (data?.user?.id) {
          const { data: adminRow } = await admin.from("admin_users").select("id").eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
          authorized = Boolean(adminRow);
        }
      }
    }
    if (!authorized) return json({ success: false, error: "Unauthorized" }, 401);
    if (!orderId) return json({ success: false, error: "Innofulfill order ID is missing" }, 400);

    const session = await getShreeMarutiGatewaySession(env);
    const res = await shreeMarutiGatewayFetch(env, "/gateway/pdf-generator/shipping-label", {
      method: "POST",
      body: JSON.stringify({ orderId, tenantId: session.tenantId, userId: session.userId }),
    }, { forceBearer: true, retryTemporary: true });

    if (!res.ok) {
      const parsed = await readGatewayError(res);
      return json({ success: false, error: parsed.message, trace_id: parsed.traceId }, res.status);
    }

    const contentType = res.headers.get("content-type") || "";
    let labelUrl: string | null = null;
    if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!validPdf(bytes)) return json({ success: false, error: "Shree Maruti returned an invalid PDF label" }, 502);
      labelUrl = `data:application/pdf;base64,${bytesToBase64(bytes)}`;
    } else {
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      const inner = data?.data ?? data;
      const raw = typeof inner === "string" ? inner : inner?.base64 || inner?.pdf || inner?.fileContent || inner?.url || null;
      if (typeof raw === "string" && raw.startsWith("http")) labelUrl = raw;
      else if (typeof raw === "string" && raw.replace(/^data:[^,]+,/, "").startsWith("JVBERi0")) {
        labelUrl = `data:application/pdf;base64,${raw.replace(/^data:[^,]+,/, "")}`;
      }
      if (!labelUrl) return json({ success: false, error: data?.message || "Shree Maruti returned an invalid label" }, 502);
    }

    const { error: persistError } = await admin.from(target).update({ label_url: labelUrl }).eq("id", targetId);
    if (persistError) return json({ success: false, error: "Label generated but could not be saved", details: persistError.message }, 500);
    return json({ success: true, label_url: labelUrl, order_id: orderId });
  } catch (err) {
    console.error("[shree-maruti-label] error", String(err));
    return json({ success: false, error: "Shree Maruti label request failed", details: String(err) }, 500);
  }
});