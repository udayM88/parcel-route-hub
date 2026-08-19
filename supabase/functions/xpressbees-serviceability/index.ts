// XpressBees serviceability + price quote.
// Looks up both pincodes in the seeded `xpressbees_pincodes` table to confirm
// coverage, derives zone from origin/destination state pair, then runs the
// in-code rate-card to return Surface + Air services in the same shape used
// by Shadowfax / Delhivery / Urbanebolt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isPartnerEnabled, partnerDisabledResponse } from "../_shared/partner-toggle.ts";
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { detectZone, quote, tatDays, zoneLabel, type XbMode } from "../_shared/xpressbees-rates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

interface PinRow {
  pincode: string;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
  is_pickup: boolean | null;
  is_prepaid: boolean | null;
}

async function geocodeFallback(pin: string): Promise<{ city: string; state: string } | null> {
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const j = await r.json();
    const po = j?.[0]?.PostOffice?.[0];
    if (po) return { city: po.District || po.Block || po.Name || "", state: po.State || "" };
  } catch (e) {
    console.warn("[xpressbees-serviceability] india-post fallback failed", pin, String(e));
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    if (!(await isPartnerEnabled("xpressbees"))) return partnerDisabledResponse("xpressbees", corsHeaders);

  try {
    getEnvironmentFromRequest(req); // env header forwarded for parity
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows } = await supabase
      .from("xpressbees_pincodes")
      .select("pincode, city, state, is_active, is_pickup, is_prepaid")
      .in("pincode", [String(pickup_pincode), String(delivery_pincode)]);

    const map: Record<string, PinRow> = {};
    (rows || []).forEach((r) => { map[r.pincode] = r as PinRow; });

    let pickup = map[pickup_pincode];
    let delivery = map[delivery_pincode];

    // Pickup must be in our serviceable set AND flagged for pickup.
    const pickupServiceable = !!pickup && pickup.is_active !== false && pickup.is_pickup === true;
    // Delivery must be in our set + active + accept prepaid (we don't ship COD).
    const deliveryServiceable = !!delivery && delivery.is_active !== false && delivery.is_prepaid !== false;

    if (!pickupServiceable || !deliveryServiceable) {
      return new Response(
        JSON.stringify({
          is_serviceable: false,
          pickup_serviceable: pickupServiceable,
          delivery_serviceable: deliveryServiceable,
          reason: !pickupServiceable
            ? "Pickup pincode not serviced by XpressBees"
            : "Delivery pincode not serviced by XpressBees",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Backfill city/state via India Post if missing in our table (rare).
    if (!pickup.city || !pickup.state) {
      const fb = await geocodeFallback(pickup_pincode);
      if (fb) { pickup = { ...pickup, city: pickup.city || fb.city, state: pickup.state || fb.state }; }
    }
    if (!delivery.city || !delivery.state) {
      const fb = await geocodeFallback(delivery_pincode);
      if (fb) { delivery = { ...delivery, city: delivery.city || fb.city, state: delivery.state || fb.state }; }
    }

    const zone = detectZone(
      pickup.city || "", pickup.state || "",
      delivery.city || "", delivery.state || "",
    );

    const modes: XbMode[] = ["surface", "air"];
    const services = modes.map((mode) => {
      const q = quote({
        zone, mode,
        weightKg: Number(weight_kg),
        lengthCm: Number(length_cm),
        widthCm: Number(width_cm),
        heightCm: Number(height_cm),
      });
      const tat = tatDays(zone, mode);
      const label = mode === "air" ? "Air" : "Surface";
      return {
        service_code: `xb_${mode}_${zone}`,
        service_name: `XpressBees ${label}`,
        tat_days: tat.days,
        tat_label: tat.label,
        delivery_modes: { express: mode === "air", standard: mode === "surface" },
        is_cod: false,
        pickup: true,
        delivery: true,
        insurance: false,
        rate: {
          rate_id: `xb_rate_${mode}_${zone}`,
          price: { amount: q.price, currency: "INR", type: "calculated" },
          description: `XpressBees ${label} (${zoneLabel(zone)})`,
        },
        metadata: {
          chargeable_weight_kg: q.chargeableWeightKg,
          volumetric_weight_kg: q.volumetricWeightKg,
          slab_weight_g: q.slabWeightG,
        },
      };
    });

    const partner = {
      partner_id: "xpressbees_direct",
      partner_code: "xpressbees",
      partner_name: "XpressBees",
      is_serviceable: true,
      rating: 4.1,
      services,
      metadata: {
        pickup_city: pickup.city,
        delivery_city: delivery.city,
        pickup_state: pickup.state,
        delivery_state: delivery.state,
        zone,
        zone_label: zoneLabel(zone),
      },
    };

    return new Response(
      JSON.stringify({ is_serviceable: true, partner }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[xpressbees-serviceability] error:", err);
    return new Response(
      JSON.stringify({ is_serviceable: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
