// Urbanebolt serviceability check + price quote.
// Uses the shared embedded UrbaneBolt rate card (Zone A–E + Special, FSC 15%).
// UB pincode API confirms serviceability and returns city/state used for zoning.
// Source of truth for rates: supabase/functions/_shared/rate-cards.ts

import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { isPartnerEnabled, partnerDisabledResponse } from "../_shared/partner-toggle.ts";
import { urbaneboltFetch } from "../_shared/urbanebolt-auth.ts";
import { quoteFromCard, type PinInfo } from "../_shared/rate-cards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

interface PincodeInfo extends PinInfo {
  serviceable?: boolean;
}

async function lookupPincodes(env: any, pincodes: string[]): Promise<Record<string, PincodeInfo>> {
  const map: Record<string, PincodeInfo> = {};
  const variants: Array<{ path: string; method: string; body?: any }> = [
    { path: `/api/v1/location/pincodes/?pincodes=${pincodes.join(",")}`, method: "GET" },
    { path: "/api/v1/location/pincodes/", method: "POST", body: { pincodes } },
    { path: "/api/v1/services/pincode/", method: "POST", body: { pincodes } },
  ];
  for (const v of variants) {
    try {
      const init: RequestInit = { method: v.method };
      if (v.body) init.body = JSON.stringify(v.body);
      const res = await urbaneboltFetch(env, v.path, init);
      const text = await res.text();
      if (!res.ok) {
        console.warn("[urbanebolt-serviceability] pincode variant failed", v.path, res.status, text.slice(0, 200));
        continue;
      }
      let data: any;
      try { data = JSON.parse(text); } catch { continue; }
      const list: any[] = data?.data || data?.results || data?.pincodes || (Array.isArray(data) ? data : []);
      for (const item of list) {
        const pin = String(item?.pincode || item?.pin || "");
        if (!pin) continue;
        map[pin] = {
          pincode: pin,
          city: item?.city || item?.city_name || "",
          state: item?.state || item?.state_name || "",
          serviceable: item?.is_serviceable !== false && item?.serviceable !== false,
        };
      }
      if (Object.keys(map).length) return map;
    } catch (e) {
      console.warn("[urbanebolt-serviceability] pincode variant error", v.path, String(e));
    }
  }
  return map;
}

const TAT_BY_ZONE: Record<string, { surface: { days: number; label: string }; air: { days: number; label: string } | null }> = {
  "Zone A": { surface: { days: 1, label: "Same Day (12 hrs)" },  air: null },
  "Zone B": { surface: { days: 1, label: "Next Day (24 hrs)" },  air: { days: 1, label: "Next Day (24 hrs)" } },
  "Zone C": { surface: { days: 2, label: "Within State (24 hrs)" }, air: { days: 1, label: "Within State Air (24 hrs)" } },
  "Zone D": { surface: { days: 2, label: "Metro (24 hrs)" }, air: { days: 1, label: "Metro Air (24 hrs)" } },
  "Zone E": { surface: { days: 3, label: "ROI (24-48 hrs)" }, air: { days: 2, label: "ROI Air (24-48 hrs)" } },
  "Special": { surface: { days: 5, label: "NE (48-72 hrs)" }, air: { days: 3, label: "NE Air (48-72 hrs)" } },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    if (!(await isPartnerEnabled("urbanebolt"))) return partnerDisabledResponse("urbanebolt", corsHeaders);

  try {
    const env = getEnvironmentFromRequest(req);
    const body = await req.json();
    const {
      pickup_pincode,
      delivery_pincode,
      weight_kg = 1,
      length_cm = 10,
      width_cm = 10,
      height_cm = 10,
    } = body;

    if (!pickup_pincode || !delivery_pincode) {
      return new Response(
        JSON.stringify({ error: "pickup_pincode and delivery_pincode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STRICT: Urbanebolt's pincode API must confirm BOTH pincodes.
    const map = await lookupPincodes(env, [pickup_pincode, delivery_pincode]);
    const pickup = map[pickup_pincode];
    const delivery = map[delivery_pincode];

    const pickupServiceable = !!pickup && pickup.serviceable === true;
    const deliveryServiceable = !!delivery && delivery.serviceable === true;
    const isServiceable = pickupServiceable && deliveryServiceable;

    if (!isServiceable) {
      return new Response(
        JSON.stringify({
          is_serviceable: false,
          pickup_serviceable: pickupServiceable,
          delivery_serviceable: deliveryServiceable,
          reason: !pickupServiceable
            ? "Pickup pincode not serviced by Urbanebolt"
            : "Delivery pincode not serviced by Urbanebolt",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dims = { l: length_cm, w: width_cm, h: height_cm };
    const surfaceCard = quoteFromCard("urbanebolt", "surface", pickup, delivery, weight_kg, dims);
    const airCard = quoteFromCard("urbanebolt", "air", pickup, delivery, weight_kg, dims);

    const services: any[] = [];
    const push = (mode: "surface" | "air", card: ReturnType<typeof quoteFromCard>) => {
      if (!card) return;
      const tat = TAT_BY_ZONE[card.zone]?.[mode];
      if (!tat) return;
      const isAir = mode === "air";
      services.push({
        service_code: `ub_${card.zone.replace(/\s+/g, "_").toLowerCase()}_${mode}`,
        service_name: `Urbanebolt ${card.zone} ${isAir ? "Air" : "Surface"}`,
        tat_days: tat.days,
        tat_label: tat.label,
        delivery_modes: { express: isAir, standard: !isAir },
        is_cod: false,
        pickup: true,
        delivery: true,
        insurance: false,
        rate: {
          rate_id: `ub_rate_${card.zone}_${mode}`,
          price: { amount: card.price_with_fsc, currency: "INR", type: "calculated" },
          description: `Urbanebolt ${card.zone} ${isAir ? "Air" : "Surface"} (incl. ${(card.fsc_percent * 100).toFixed(0)}% FSC)`,
        },
        metadata: {
          rate_source: "card",
          card_price: card.price_with_fsc,
          card_zone: card.zone,
          chargeable_g: card.chargeable_g,
          fsc_percent: card.fsc_percent,
        },
      });
    };

    push("surface", surfaceCard);
    // Air: skip Zone A (intracity SDD has no air option)
    if (airCard && airCard.zone !== "Zone A") push("air", airCard);

    if (services.length === 0) {
      return new Response(
        JSON.stringify({
          is_serviceable: false,
          reason: "No rate available for this zone/weight combination",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const partner = {
      partner_id: "urbanebolt_direct",
      partner_code: "urbanebolt",
      partner_name: "Urbanebolt",
      is_serviceable: true,
      rating: 4.0,
      services,
      metadata: {
        pickup_city: pickup.city,
        delivery_city: delivery.city,
        pickup_state: pickup.state,
        delivery_state: delivery.state,
        zone: surfaceCard?.zone ?? null,
        rate_card: "ViaSetu_1.xlsx (embedded)",
      },
    };

    return new Response(
      JSON.stringify({ is_serviceable: true, partner }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[urbanebolt-serviceability] error:", err);
    return new Response(
      JSON.stringify({ is_serviceable: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
