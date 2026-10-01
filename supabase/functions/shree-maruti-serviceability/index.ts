// Shree Maruti Innofulfill serviceability check.
// Pricing: LIVE rate API first
// (https://apis.innofulfill.com/gateway/ure/api/external/rate-calculation/calculate/v2),
// with the embedded rate card (supabase/functions/_shared/rate-cards.ts,
// source: ViaSetu_1.xlsx) used for verification and as fallback.
//
// We still call the partner serviceability endpoint to confirm whether
// SURFACE / AIR is available for the pincode pair before quoting from the card.

import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { isPartnerEnabled, partnerDisabledResponse } from "../_shared/partner-toggle.ts";
import { shreeMarutiGatewayFetch } from "../_shared/shree-maruti-gateway.ts";
import { fetchShreeMarutiLiveRate } from "../_shared/shree-maruti-rate-api.ts";
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

async function checkLane(env: any, fromPin: number, toPin: number) {
  try {
    const res = await shreeMarutiGatewayFetch(
      env,
      "/gateway/serviceability/ecomm",
      {
        method: "POST",
        body: JSON.stringify({
          fromPincode: fromPin,
          toPincode: toPin,
          paymentMode: "PREPAID",
          operationType: "PICKUP_DELIVERY",
          carriers: ["SMILE"],
        }),
      },
      { retryTemporary: true },
    );
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      console.warn("[shree-maruti-serviceability] failed", res.status, text.slice(0, 300));
      return { ok: false, reason: data?.message || "Partner serviceability API unavailable", data };
    }
    const entries = Array.isArray(data?.data) ? data.data : [];
    const entry = entries.find((item: any) => Array.isArray(item?.carriers) && item.carriers.some(
      (candidate: any) => String(candidate?.carrier || candidate?.carrierCode || candidate?.name || "").toUpperCase() === "SMILE",
    )) || null;
    const carrier = Array.isArray(entry?.carriers)
      ? entry.carriers.find((item: any) => String(item?.carrier || item?.carrierCode || item?.name || "").toUpperCase() === "SMILE")
      : null;
    return {
      ok: carrier?.serviceable === true,
      reason: carrier?.reason || (carrier ? "Pincode pair not serviced by Shree Maruti" : "SMILE result missing"),
      data: entry,
      traceId: data?.trace_id || data?.traceId || null,
    };

  } catch (e) {
    console.warn("[shree-maruti-serviceability] error", String(e));
    return { ok: false, reason: "Partner serviceability API unavailable", data: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    if (!(await isPartnerEnabled("shree_maruti"))) return partnerDisabledResponse("shree_maruti", corsHeaders);

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

    if (!/^\d{6}$/.test(String(pickup_pincode)) || !/^\d{6}$/.test(String(delivery_pincode)) ||
        !(Number(weight_kg) > 0) || !(Number(length_cm) > 0) || !(Number(width_cm) > 0) || !(Number(height_cm) > 0)) {
      return new Response(JSON.stringify({ error: "Valid pincodes and positive weight/dimensions are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The serviceability endpoint is lane-based. Mode availability comes from
    // successful mode-specific rate responses, never from inferred coverage.
    const [lane, pickupInfo, deliveryInfo] = await Promise.all([
      checkLane(env, fromPin, toPin),
      lookupPinInfo(String(pickup_pincode)),
      lookupPinInfo(String(delivery_pincode)),
    ]);

    if (!lane.ok) {
      return new Response(
        JSON.stringify({
          is_serviceable: false,
          reason: lane.reason || "Pincode pair not serviced by Shree Maruti",
          trace_id: lane.traceId || null,
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
      const live = await fetchShreeMarutiLiveRate(env, {
        pickup_pincode: fromPin, delivery_pincode: toPin,
        weight_kg: Number(weight_kg), length_cm: Number(length_cm),
        width_cm: Number(width_cm), height_cm: Number(height_cm), mode,
      });
      // An explicitly serviceable lane still needs a mode-specific live rate.
      // The card remains a temporary price fallback only when the rate API is unavailable.
      const resolved = resolvePrice(live?.amount ?? null, card);
      if (!resolved.price) return;
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
          api_gst: live?.gstAmount ?? null,
          api_total: live?.totalAmount ?? null,
          api_trace_id: live?.traceId ?? null,
        },
      });
    };

    await Promise.all([
      buildService("SURFACE"),
      buildService("AIR"),
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
        pricing_source: services.some((service) => service.metadata.rate_source === "api") ? "api" : "embedded_card",
        serviceability_trace_id: lane.traceId || null,
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
