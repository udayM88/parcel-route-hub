// XpressBees label fetch.
// Per franchise_apidoc: there is NO standalone label endpoint — the label URL
// (`label`) is returned in the create-shipment response and stored on the
// booking row by save-booking. So this function reads it back from the DB.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { waybill, awb, booking_id, box_id } = await req.json().catch(() => ({}));
    const trackId = waybill || awb;
    if (!trackId && !booking_id) {
      return new Response(JSON.stringify({ success: false, error: "waybill or booking_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let labelUrl: string | null = null;

    // Multi-parcel orders store one label per parcel on booking_boxes.
    if (box_id) {
      const { data } = await supabase
        .from("booking_boxes")
        .select("label_url")
        .eq("id", box_id)
        .maybeSingle();
      labelUrl = data?.label_url || null;
    }

    if (!labelUrl && trackId) {
      const { data } = await supabase
        .from("booking_boxes")
        .select("label_url")
        .eq("tracking_id", String(trackId))
        .maybeSingle();
      labelUrl = data?.label_url || null;
    }

    if (!labelUrl && booking_id) {
      const { data } = await supabase
        .from("bookings")
        .select("label_url")
        .eq("id", booking_id)
        .maybeSingle();
      labelUrl = data?.label_url || null;
    }

    if (!labelUrl && trackId) {
      const { data } = await supabase
        .from("bookings")
        .select("label_url")
        .or(`prayog_awb.eq.${trackId},tracking_id.eq.${trackId}`)
        .maybeSingle();
      labelUrl = data?.label_url || null;
    }

    if (!labelUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: "Label not available. XpressBees returns the label URL only at booking time.",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, label_url: labelUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[xpressbees-label] error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
