// Shadowfax Marketplace 360 — status callback receiver (register URL with Shadowfax).
// Shadowfax callbacks are unsigned, so the payload is only a hint: we re-read the
// AWB's status from the Shadowfax tracking API before recording anything.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { recordCourierStatus } from "../_shared/status-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET: Record<string, string> = {
  DELIVERED: "DELIVERED", OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY", IN_TRANSIT: "IN_TRANSIT", RTO: "RTO", CANCELLED: "CANCELLED",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  console.log("[shadowfax-webhook] payload:", JSON.stringify(body).slice(0, 2000));
  const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [body];

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, key);
  let updated = 0;

  for (const it of items) {
    const awb = String(it?.awb_number || it?.awb || "").replace(/[^A-Za-z0-9]/g, "");
    if (!awb) continue;
    const { data: booking } = await supabase.from("bookings").select("*")
      .or(`prayog_awb.eq.${awb},tracking_id.eq.${awb}`).maybeSingle();
    if (!booking) { console.warn("[shadowfax-webhook] no booking for", awb); continue; }

    const env = "production";
    const tr = await fetch(`${url}/functions/v1/shadowfax-tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "x-environment": env },
      body: JSON.stringify({ awb }),
    }).then((r) => r.json()).catch(() => null);
    const latest = tr?.statuses?.[0];
    if (!latest) { console.warn("[shadowfax-webhook] could not verify status for", awb); continue; }

    await recordCourierStatus(supabase, booking, latest, { source: "webhook", partnerKey: "shadowfax" });
    const status = BUCKET[latest.category];
    if (status && status !== booking.status && !["CANCELLED", "DELIVERED"].includes(booking.status)) {
      await supabase.from("bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", booking.id);
      updated++;
    }
  }
  return json({ success: true, updated });
});
