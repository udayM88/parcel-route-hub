// Urbanebolt webhook receiver — public endpoint registered in Urbanebolt panel.
// Accepts status update payloads and updates the matching booking row by AWB.
//
// Sample payload (from Urbanebolt support):
// [{
//   "awb":"10003078293", "edd":"2023-09-22 08:21:32", "lat":0, "lng":0,
//   "pieces":1, "weight":"0.2", "pod_url":"", "remarks":"", "customer":"CS100001",
//   "isReturn":false, "event_date":"2023-09-22 08:17:37", "reason_code":"",
//   "status_code":"DDL", "order_number":"404133513", "otp_verified":"No",
//   "product_type":"PPD", "reference_awb":"", "event_location":"ADHR",
//   "status_description":"Delivered"
// }]

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { recordCourierStatus } from "../_shared/status-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Urbanebolt status_code (primary) and fall back to status_description.
// Codes per Urbanebolt convention: PKD/OFP picked, INT in-transit, OFD out-for-delivery,
// DDL delivered, RTO/RAD return, CNL cancel, MNF/BKD manifested.
function normalizeStatus(code: string, desc: string): string {
  const c = (code || "").toUpperCase().trim();
  switch (c) {
    case "DDL": return "DELIVERED";
    case "OFD": return "OUT_FOR_DELIVERY";
    case "PKD":
    case "OFP":
    case "INT":
    case "RAD": return "IN_TRANSIT";
    case "RTO":
    case "RTD":
    case "RTO_DELIVERED": return "RTO";
    case "CNL":
    case "CAN": return "CANCELLED";
    case "MNF":
    case "BKD": return "ORDER_CONFIRMED";
  }
  const v = (desc || "").toLowerCase();
  if (v.includes("delivered")) return "DELIVERED";
  if (v.includes("out for delivery")) return "OUT_FOR_DELIVERY";
  if (v.includes("picked") || v.includes("transit") || v.includes("dispatched") || v.includes("hub")) return "IN_TRANSIT";
  if (v.includes("rto") || v.includes("return")) return "RTO";
  if (v.includes("cancel")) return "CANCELLED";
  if (v.includes("manifest") || v.includes("booked") || v.includes("created")) return "ORDER_CONFIRMED";
  return desc || "UPDATED";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify shared secret sent by Urbanebolt (Authorization: Bearer <token>)
    const expected = Deno.env.get("URBANEBOLT_WEBHOOK_TOKEN");
    if (expected) {
      const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
      const provided = auth.replace(/^Bearer\s+/i, "").trim();
      if (provided !== expected) {
        console.warn("[urbanebolt-webhook] unauthorized — token mismatch");
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    console.log("[urbanebolt-webhook] payload:", JSON.stringify(body).slice(0, 2000));

    // Urbanebolt sends an array of events. Also tolerate { data | shipments | events: [...] } and single object.
    const items: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.events)
        ? body.events
        : Array.isArray(body?.shipments)
          ? body.shipments
          : Array.isArray(body?.data)
            ? body.data
            : [body?.data || body];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let updated = 0;
    let notified = 0;
    for (const item of items) {
      if (!item) continue;
      const awb: string | null =
        item.awb || item.awb_no || item.waybill || item.tracking_id || null;
      const rawDesc = item.status_description || item.status || item.event;
      const rawCode = item.status_code || null;
      if (!awb || (!String(rawDesc || "").trim() && !String(rawCode || "").trim())) {
        console.warn("[urbanebolt-webhook] incomplete event ignored:", JSON.stringify(item).slice(0, 400));
        continue;
      }

      const { data: booking } = await supabase
        .from("bookings").select("*")
        .or(`prayog_awb.eq.${awb},tracking_id.eq.${awb}`)
        .maybeSingle();
      if (!booking) {
        console.warn("[urbanebolt-webhook] no booking for awb", awb);
        continue;
      }

      const result = await recordCourierStatus(
        supabase,
        booking,
        {
          status: rawDesc,
          statusCode: rawCode,
          remarks: item.remarks || item.reason_code || null,
          timestamp: item.event_date || item.event_time || null,
          ...item,
        },
        { source: "webhook", partnerKey: "urbanebolt" },
      );
      if (result.notified) notified++;

      const status = normalizeStatus(rawCode, rawDesc);
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (item.pod_url) update.label_url = item.pod_url;

      const { error } = await supabase.from("bookings").update(update).eq("id", booking.id);
      if (error) {
        console.warn("[urbanebolt-webhook] update failed for awb", awb, error.message);
      } else {
        updated++;
      }
    }

    return new Response(JSON.stringify({ success: true, updated, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[urbanebolt-webhook] error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
