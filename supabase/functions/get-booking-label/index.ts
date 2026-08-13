import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-prayog-auth, x-environment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const prayogAuthHeader = req.headers.get("x-prayog-auth");
    if (!prayogAuthHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    try {
      const parsed = JSON.parse(prayogAuthHeader);
      userId = parsed.user_id;
      if (!userId) throw new Error("Missing user_id");
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { booking_id, order_id } = await req.json().catch(() => ({}));
    if (!booking_id && !order_id) {
      return new Response(JSON.stringify({ success: false, error: "booking_id or order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let query = supabase.from("bookings").select("*").eq("user_id", userId);
    if (booking_id) {
      query = query.eq("id", booking_id);
    } else {
      query = query.or(`prayog_order_id.eq.${order_id},tracking_id.eq.${order_id},prayog_awb.eq.${order_id}`);
    }
    const { data: b, error } = await query.maybeSingle();

    if (error || !b) {
      return new Response(JSON.stringify({ success: false, error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Stored URL wins
    if (b.label_url) {
      return new Response(JSON.stringify({ success: true, label_url: b.label_url, source: "cached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the courier from partner_id / courier_name too — assisted and
    // manually-attached bookings carry booking_source "admin_assisted".
    const key = resolvePartnerKey(b.partner_id, b.courier_name, b.booking_source);
    const source = key ? `${key}_direct` : (b.booking_source || "");
    const awb = b.prayog_awb || b.tracking_id;


    // 2) Delhivery: fetch on demand and persist
    if (source === "delhivery_direct") {
      if (!awb) {
        return new Response(JSON.stringify({ success: false, error: "AWB missing for Delhivery booking" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const env = req.headers.get("x-environment") || "production";
      const res = await fetch(`${supabaseUrl}/functions/v1/delhivery-label`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-environment": env,
        },
        body: JSON.stringify({ waybill: awb }),
      });
      const payload = await res.json().catch(() => ({}));
      const labelUrl = payload?.label_url || null;

      if (labelUrl) {
        await supabase.from("bookings").update({ label_url: labelUrl }).eq("id", b.id);
        return new Response(JSON.stringify({ success: true, label_url: labelUrl, source: "delhivery_fresh" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: "Label not yet available from Delhivery. Please try again in a few minutes." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Urbanebolt: fetch on demand and persist
    if (source === "urbanebolt_direct") {
      if (!awb) {
        return new Response(JSON.stringify({ success: false, error: "AWB missing for Urbanebolt booking" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const env = req.headers.get("x-environment") || "production";
      const res = await fetch(`${supabaseUrl}/functions/v1/urbanebolt-label`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-environment": env,
        },
        body: JSON.stringify({ waybill: awb }),
      });
      const payload = await res.json().catch(() => ({}));
      const labelUrl = payload?.label_url || null;

      if (labelUrl) {
        await supabase.from("bookings").update({ label_url: labelUrl }).eq("id", b.id);
        return new Response(JSON.stringify({ success: true, label_url: labelUrl, source: "urbanebolt_fresh" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: "Label not yet available from Urbanebolt. Please try again in a few minutes." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3b) XpressBees: fetch on demand and persist
    if (source === "xpressbees_direct") {
      if (!awb) {
        return new Response(JSON.stringify({ success: false, error: "AWB missing for XpressBees booking" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const env = req.headers.get("x-environment") || "production";
      const res = await fetch(`${supabaseUrl}/functions/v1/xpressbees-label`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-environment": env,
        },
        body: JSON.stringify({ waybill: awb }),
      });
      const payload = await res.json().catch(() => ({}));
      const labelUrl = payload?.label_url || null;

      if (labelUrl) {
        await supabase.from("bookings").update({ label_url: labelUrl }).eq("id", b.id);
        return new Response(JSON.stringify({ success: true, label_url: labelUrl, source: "xpressbees_fresh" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: "Label not yet available from XpressBees. Please try again in a few minutes." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3c) Shree Maruti: fetch on demand and persist (returns base64 data URL).
    if (source === "shree_maruti_direct") {
      if (!awb) {
        return new Response(JSON.stringify({ success: false, error: "AWB missing for Shree Maruti booking" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const env = req.headers.get("x-environment") || "production";
      const res = await fetch(`${supabaseUrl}/functions/v1/shree-maruti-label`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-environment": env,
        },
        body: JSON.stringify({ waybill: awb, cAwb: awb, booking_id: b.id }),
      });
      const payload = await res.json().catch(() => ({}));
      const labelUrl = payload?.label_url || null;
      if (labelUrl) {
        // shree-maruti-label already persists, but ensure idempotently
        if (!labelUrl.startsWith("data:")) {
          await supabase.from("bookings").update({ label_url: labelUrl }).eq("id", b.id);
        }
        return new Response(JSON.stringify({ success: true, label_url: labelUrl, source: "shree_maruti_fresh" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: "Label not yet available from Shree Maruti. Please try again in a few minutes." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Shadowfax: generate an in-house printable label (no native label API).
    if (source === "shadowfax_direct") {
      const env = req.headers.get("x-environment") || "production";
      const res = await fetch(`${supabaseUrl}/functions/v1/shadowfax-label`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-environment": env,
        },
        body: JSON.stringify({ booking_id: b.id, awb }),
      });
      const payload = await res.json().catch(() => ({}));
      const labelUrl = payload?.label_url || null;
      if (labelUrl) {
        return new Response(JSON.stringify({ success: true, label_url: labelUrl, source: "shadowfax_generated", format: payload.format || "html" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: payload?.error || "Could not generate Shadowfax label." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      unsupported: true,
      error: "Shipping label is not available for this courier.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-booking-label error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
