// XpressBees webhook receiver — public endpoint registered in XpressBees panel.
// Accepts shipment status updates and updates the matching booking row by AWB.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { recordCourierStatus } from "../_shared/status-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeStatus(status: string): string {
  const v = (status || "").toLowerCase().trim();
  if (v.includes("delivered")) return "DELIVERED";
  if (v.includes("out for delivery") || v.includes("ofd")) return "OUT_FOR_DELIVERY";
  if (v.includes("rto") || v.includes("return")) return "RTO";
  if (v.includes("cancel")) return "CANCELLED";
  if (v.includes("picked") || v.includes("transit") || v.includes("dispatched") || v.includes("hub") || v.includes("manifest")) return "IN_TRANSIT";
  if (v.includes("booked") || v.includes("created") || v.includes("pending")) return "ORDER_CONFIRMED";
  return status || "UPDATED";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    console.log("[xpressbees-webhook] payload:", JSON.stringify(body).slice(0, 2000));

    // Tolerate single-object, array, or wrapped shapes.
    const items: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.shipments) ? body.shipments
      : Array.isArray(body?.data) ? body.data
      : Array.isArray(body?.events) ? body.events
      : [body?.data || body];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let updated = 0;
    let notified = 0;
    for (const item of items) {
      if (!item) continue;
      const awb: string | null =
        item.awb || item.awb_number || item.awbNumber || item.waybill || item.tracking_id || null;
      const rawStatus = item.status || item.current_status || item.status_description || item.event;
      // Incomplete / invalid payload — never notify on a guess.
      if (!awb || !String(rawStatus || "").trim()) {
        console.warn("[xpressbees-webhook] incomplete event ignored:", JSON.stringify(item).slice(0, 400));
        continue;
      }

      const { data: booking } = await supabase
        .from("bookings").select("*")
        .or(`prayog_awb.eq.${awb},tracking_id.eq.${awb}`)
        .maybeSingle();
      if (!booking) {
        console.warn("[xpressbees-webhook] no booking for awb", awb);
        continue;
      }

      // Normalize + audit + notify through the single shared status engine.
      const result = await recordCourierStatus(
        supabase,
        booking,
        {
          status: rawStatus,
          statusCode: item.status_code || item.code || null,
          remarks: item.remarks || item.reason || null,
          timestamp: item.event_time || item.timestamp || item.event_date || null,
          ...item,
        },
        { source: "webhook", partnerKey: "xpressbees" },
      );
      if (result.notified) notified++;

      const status = normalizeStatus(String(rawStatus));
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (item.label || item.label_url) update.label_url = item.label || item.label_url;

      const { error } = await supabase.from("bookings").update(update).eq("id", booking.id);
      if (error) {
        console.warn("[xpressbees-webhook] update failed for awb", awb, error.message);
      } else {
        updated++;
      }
    }

    return new Response(JSON.stringify({ success: true, updated, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[xpressbees-webhook] error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
