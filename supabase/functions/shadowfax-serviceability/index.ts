import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { isPartnerEnabled, partnerDisabledResponse } from "../_shared/partner-toggle.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};

// Shadowfax Rate Card (RVP = Reverse Pickup = 1.7x of Forward rates)
// Forward rates per 500g slab
const RATE_CARD = {
  standard: {
    // category: { first500g, additional500g, tatDays, fscPercent }
    intracity:    { first: 33, additional: 28, tat: "1-2 Days", tatDays: 2, fsc: 0.30 },
    within_zone:  { first: 39, additional: 31, tat: "2-3 Days", tatDays: 3, fsc: 0.30 },
    metro:        { first: 55, additional: 45, tat: "3-4 Days", tatDays: 4, fsc: 0.30 },
    roi:          { first: 60, additional: 49, tat: "5-6 Days", tatDays: 6, fsc: 0.30 },
    special_zone: { first: 72, additional: 58, tat: "7-8 Days", tatDays: 8, fsc: 0.30 },
  },
  express: {
    intracity_sdd:  { first: 45, additional: 37, tat: "Same Day", tatDays: 0, fsc: 0.10 },
    intracity_ndd:  { first: 40, additional: 32, tat: "Next Day", tatDays: 1, fsc: 0.10 },
    zonal_ndd:      { first: 42, additional: 34, tat: "Next Day", tatDays: 1, fsc: 0.10 },
    intercity_air:  { first: 59, additional: 48, tat: "Next Day", tatDays: 1, fsc: 0.10 },
  },
};

const RVP_MULTIPLIER = 1.7;

// Metro cities list for zone detection
const METRO_CITIES = new Set([
  "delhi", "new delhi", "mumbai", "bangalore", "bengaluru", "chennai",
  "kolkata", "hyderabad", "pune", "ahmedabad",
]);

// Special zone states (NE + J&K + remote)
const SPECIAL_ZONE_STATES = new Set([
  "assam", "arunachal pradesh", "manipur", "meghalaya", "mizoram",
  "nagaland", "tripura", "sikkim", "jammu and kashmir", "ladakh",
  "andaman and nicobar islands", "lakshadweep",
]);

interface ZoneResult {
  standardCategory: string;
  expressCategory: string | null;
}

function detectZone(
  pickupCity: string, pickupState: string, pickupRegion: string,
  deliveryCity: string, deliveryState: string, deliveryRegion: string
): ZoneResult {
  const pCity = (pickupCity || "").toLowerCase().trim();
  const dCity = (deliveryCity || "").toLowerCase().trim();
  const pState = (pickupState || "").toLowerCase().trim();
  const dState = (deliveryState || "").toLowerCase().trim();
  const pRegion = (pickupRegion || "").toLowerCase().trim();
  const dRegion = (deliveryRegion || "").toLowerCase().trim();

  // Check special zone first
  if (SPECIAL_ZONE_STATES.has(pState) || SPECIAL_ZONE_STATES.has(dState)) {
    return { standardCategory: "special_zone", expressCategory: null };
  }

  // Intracity: same city
  if (pCity && dCity && pCity === dCity) {
    return { standardCategory: "intracity", expressCategory: "intracity_ndd" };
  }

  // Within zone: same state or same region
  if (pState === dState || (pRegion && dRegion && pRegion === dRegion)) {
    return { standardCategory: "within_zone", expressCategory: "zonal_ndd" };
  }

  // Metro: either city is a metro
  if (METRO_CITIES.has(pCity) || METRO_CITIES.has(dCity)) {
    return { standardCategory: "metro", expressCategory: "intercity_air" };
  }

  // ROI: everything else
  return { standardCategory: "roi", expressCategory: "intercity_air" };
}

function calculatePrice(
  rateEntry: { first: number; additional: number; fsc: number },
  weightKg: number,
  lengthCm: number, widthCm: number, heightCm: number
): number {
  // Volumetric weight: L*B*H / 5000
  const volWeight = (lengthCm * widthCm * heightCm) / 5000;
  const chargeableWeight = Math.max(weightKg, volWeight);

  // Convert to grams for slab calculation
  const weightG = chargeableWeight * 1000;
  const slabs = Math.ceil(weightG / 500);

  // First 500g + additional slabs
  let forwardPrice = rateEntry.first;
  if (slabs > 1) {
    forwardPrice += (slabs - 1) * rateEntry.additional;
  }

  // Apply RVP multiplier (1.7x of forward)
  let rvpPrice = forwardPrice * RVP_MULTIPLIER;

  // Apply FSC (Fuel Surcharge) on freight
  rvpPrice += rvpPrice * rateEntry.fsc;

  return Math.round(rvpPrice);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

    if (!(await isPartnerEnabled("shadowfax"))) return partnerDisabledResponse("shadowfax", corsHeaders);

  try {
    const body = await req.json();
    const { pickup_pincode, delivery_pincode, weight_kg = 1, length_cm = 10, width_cm = 10, height_cm = 10 } = body;

    if (!pickup_pincode || !delivery_pincode) {
      return new Response(
        JSON.stringify({ error: "pickup_pincode and delivery_pincode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if both pincodes exist in shadowfax_pincodes table
    const { data: pincodes, error } = await supabase
      .from("shadowfax_pincodes")
      .select("pincode, city, state, region, hub")
      .in("pincode", [pickup_pincode, delivery_pincode])
      .eq("is_active", true);

    if (error) {
      console.error("DB query error:", error);
      return new Response(
        JSON.stringify({ is_serviceable: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pickupFound = pincodes?.find((p) => p.pincode === pickup_pincode);
    const deliveryFound = pincodes?.find((p) => p.pincode === delivery_pincode);
    const isServiceable = !!pickupFound && !!deliveryFound;

    if (!isServiceable) {
      return new Response(
        JSON.stringify({
          is_serviceable: false,
          pickup_serviceable: !!pickupFound,
          delivery_serviceable: !!deliveryFound,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect zone
    const zone = detectZone(
      pickupFound.city, pickupFound.state, pickupFound.region,
      deliveryFound.city, deliveryFound.state, deliveryFound.region
    );

    const stdRate = RATE_CARD.standard[zone.standardCategory as keyof typeof RATE_CARD.standard];
    const stdPrice = calculatePrice(stdRate, weight_kg, length_cm, width_cm, height_cm);

    const services: any[] = [
      {
        service_code: "sfx_standard",
        service_name: "Shadowfax Standard",
        tat_days: stdRate.tatDays,
        tat_label: stdRate.tat,
        delivery_modes: { express: false, standard: true },
        is_cod: true,
        pickup: true,
        delivery: true,
        insurance: false,
        rate: {
          rate_id: "sfx_rate_standard",
          price: { amount: stdPrice, currency: "INR", type: "calculated" },
          description: `RVP Standard (${zone.standardCategory.replace("_", " ")})`,
        },
      },
    ];

    // Add express service if available for this zone
    if (zone.expressCategory) {
      const expRate = RATE_CARD.express[zone.expressCategory as keyof typeof RATE_CARD.express];
      if (expRate) {
        const expPrice = calculatePrice(expRate, weight_kg, length_cm, width_cm, height_cm);
        services.push({
          service_code: "sfx_express",
          service_name: "Shadowfax Express",
          tat_days: expRate.tatDays,
          tat_label: expRate.tat,
          delivery_modes: { express: true, standard: false },
          is_cod: true,
          pickup: true,
          delivery: true,
          insurance: false,
          rate: {
            rate_id: "sfx_rate_express",
            price: { amount: expPrice, currency: "INR", type: "calculated" },
            description: `RVP Express (${zone.expressCategory.replace("_", " ")})`,
          },
        });
      }
    }

    const partner = {
      partner_id: "shadowfax_direct",
      partner_code: "shadowfax",
      partner_name: "Shadowfax",
      is_serviceable: true,
      rating: 4.2,
      services,
      metadata: {
        pickup_hub: pickupFound.hub,
        delivery_hub: deliveryFound.hub,
        pickup_city: pickupFound.city,
        delivery_city: deliveryFound.city,
        zone: zone.standardCategory,
      },
    };

    return new Response(
      JSON.stringify({ is_serviceable: true, partner }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Serviceability error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
