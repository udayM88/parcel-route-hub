// Shree Maruti rate calculation — LIVE API first, embedded card as fallback.
// Live: https://apis.innofulfill.com/gateway/ure/api/external/rate-calculation/calculate/v2
// Fallback / verification: supabase/functions/_shared/rate-cards.ts (ViaSetu_1.xlsx)

import { quoteFromCard, resolvePrice } from "../_shared/rate-cards.ts";
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { fetchShreeMarutiLiveRate } from "../_shared/shree-maruti-rate-api.ts";

async function pinInfo(pin: string) {
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const j = await r.json();
    const po = j?.[0]?.PostOffice?.[0];
    if (po) return { pincode: pin, city: po.District || po.Block || po.Name || "", state: po.State || "" };
  } catch (_) { /* swallow */ }
  return { pincode: pin };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const body = await req.json();
    const {
      pickup_pincode, delivery_pincode,
      weight_kg = 1,
      length_cm = 10, width_cm = 10, height_cm = 10,
      mode = "SURFACE", // "SURFACE" | "AIR"
      declared_value,
    } = body;

    if (!pickup_pincode || !delivery_pincode) {
      return new Response(
        JSON.stringify({ error: "pickup_pincode and delivery_pincode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const upperMode = String(mode).toUpperCase() === "AIR" ? "AIR" : "SURFACE";
    const dims = { l: Number(length_cm), w: Number(width_cm), h: Number(height_cm) };

    const [pInfo, dInfo, live] = await Promise.all([
      pinInfo(String(pickup_pincode)),
      pinInfo(String(delivery_pincode)),
      fetchShreeMarutiLiveRate(env, {
        pickup_pincode, delivery_pincode,
        weight_kg: Number(weight_kg),
        length_cm: dims.l, width_cm: dims.w, height_cm: dims.h,
        mode: upperMode,
        declared_value,
      }),
    ]);

    const card = quoteFromCard(
      "shree_maruti",
      upperMode === "AIR" ? "air" : "surface",
      pInfo, dInfo, Number(weight_kg), dims,
    );

    const resolved = resolvePrice(live?.amount ?? null, card);

    if (!resolved.price) {
      return new Response(
        JSON.stringify({
          error: "No rate available (live API and embedded card both failed)",
          details: { mode: upperMode, pickup: pInfo, delivery: dInfo, weight_kg },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({
      success: true,
      data: { totalAmount: resolved.price },
      rate_source: resolved.rate_source,
      api_price: live?.amount ?? null,
      card_zone: card?.zone ?? null,
      card_price: card?.price_with_fsc ?? null,
      card_delta_pct: resolved.verify?.delta_pct ?? null,
      chargeable_g: card?.chargeable_g ?? null,
      card_version: card?.card_version ?? null,
      final_price: resolved.price,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[shree-maruti-rate] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
