// Shree Maruti (Innofulfill / Delcaper) serviceability check.
// Pricing: LIVE rate API first
// (https://apis.innofulfill.com/gateway/ure/api/external/rate-calculation/calculate/v2),
// with the embedded rate card (supabase/functions/_shared/rate-cards.ts,
// source: ViaSetu_1.xlsx) used for verification and as fallback.
//
// We still call the partner serviceability endpoint to confirm whether
// SURFACE / AIR is available for the pincode pair before quoting from the card.

import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { shreeMarutiFetch } from "../_shared/shree-maruti-auth.ts";
import { quoteFromCard, resolvePrice, type PinInfo } from "../_shared/rate-cards.ts";

async function lookupPinInfo(pin: string): Promise<PinInfo> {
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

interface ServiceabilityBody {
  pickup_pincode?: string | number;
  delivery_pincode?: string | number;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}

async function checkMode(env: any, fromPin: number, toPin: number, mode: "SURFACE" | "AIR") {
  try {
    const res = await shreeMarutiFetch(
      env,
      "/fulfillment/public/seller/order/check-ecomm-order-serviceability",
      {
        method: "POST",
        body: JSON.stringify({
          fromPincode: fromPin,
          toPincode: toPin,
          isCodOrder: false,
          deliveryMode: mode,
        }),
      },
    );
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      console.warn("[shree-maruti-serviceability]", mode, "failed", res.status, text.slice(0, 300));
      return { ok: false, data };
    }
    const inner = data?.data ?? data;
    const serviceable =
      inner?.isServiceable === true ||
      inner?.serviceable === true ||
      inner?.feasible === true ||
      (data?.status === 200 && inner !== false);
    return { ok: !!serviceable, data: inner };
  } catch (e) {
    console.warn("[shree-maruti-serviceability]", mode, "error", String(e));
    return { ok: false, data: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const body = (await req.json()) as ServiceabilityBody;
    const {
      pickup_pincode, delivery_pincode,
      weight_kg = 1,
      length_cm = 10, width_cm = 10, height_cm = 10,
    } = body;

    if (!pickup_pincode || !delivery_pincode) {
      return new Response(
        JSON.stringify({ error: "pickup_pincode and delivery_pincode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fromPin = Number(pickup_pincode);
    const toPin = Number(delivery_pincode);

    // Check both modes for serviceability + resolve pin info, all in parallel.
    const [surface, air, pickupInfo, deliveryInfo] = await Promise.all([
      checkMode(env, fromPin, toPin, "SURFACE"),
      checkMode(env, fromPin, toPin, "AIR"),
      lookupPinInfo(String(pickup_pincode)),
      lookupPinInfo(String(delivery_pincode)),
    ]);

    if (!surface.ok && !air.ok) {
      return new Response(
        JSON.stringify({
          is_serviceable: false,
          reason: "Pincode pair not serviced by Shree Maruti",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dims = { l: length_cm, w: width_cm, h: height_cm };
    const services: any[] = [];

    const buildService = async (mode: "SURFACE" | "AIR") => {
      const isAir = mode === "AIR";
      const card = quoteFromCard(
        "shree_maruti",
        isAir ? "air" : "surface",
        pickupInfo, deliveryInfo,
        weight_kg, dims,
      );
      // Card-only pricing for Shree Maruti (live API deliberately not used).
      const live: { amount: number } | null = null;
      const resolved = resolvePrice(null, card);
      if (!resolved.price) return; // neither API nor card can price this mode
      services.push({
        service_code: isAir ? "shree_maruti_express" : "shree_maruti_surface",
        service_name: isAir ? "Shree Maruti Express (Air)" : "Shree Maruti Surface",
        tat_days: isAir ? 2 : 4,
        tat_label: isAir ? "1-2 days" : "3-5 days",
        delivery_modes: { express: isAir, standard: !isAir },
        is_cod: false,
        pickup: true,
        delivery: true,
        insurance: false,
        rate: {
          rate_id: `sm_rate_${mode.toLowerCase()}`,
          price: { amount: resolved.price, currency: "INR", type: "calculated" },
          description: isAir ? "Shree Maruti Air" : "Shree Maruti Surface",
        },
        metadata: {
          rate_source: resolved.rate_source,
          api_price: live?.amount ?? null,
          card_price: card?.price_with_fsc ?? null,
          card_zone: card?.zone ?? null,
          card_delta_pct: resolved.verify?.delta_pct ?? null,
          chargeable_g: card?.chargeable_g ?? null,
          card_version: card?.card_version ?? null,
        },
      });
    };

    await Promise.all([
      surface.ok ? buildService("SURFACE") : Promise.resolve(),
      air.ok ? buildService("AIR") : Promise.resolve(),
    ]);

    if (services.length === 0) {
      return new Response(
        JSON.stringify({
          is_serviceable: false,
          reason: "No rate available for this pincode pair / weight",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const partner = {
      partner_id: "shree_maruti_direct",
      partner_code: "shree_maruti",
      partner_name: "Shree Maruti Courier",
      is_serviceable: true,
      rating: 4.0,
      services,
      metadata: {
        pickup_city: pickupInfo.city,
        delivery_city: deliveryInfo.city,
        pickup_state: pickupInfo.state,
        delivery_state: deliveryInfo.state,
        pricing_source: "embedded_card",
      },
    };

    return new Response(
      JSON.stringify({ is_serviceable: true, partner }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[shree-maruti-serviceability] error:", err);
    return new Response(
      JSON.stringify({ is_serviceable: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
