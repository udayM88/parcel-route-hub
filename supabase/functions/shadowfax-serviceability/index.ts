// Shadowfax Marketplace 360 — forward serviceability + price.
// Coverage: live Shadowfax serviceability API only (both pincodes must be listed).
// Price: SFX_Ratecard.xlsx "Standard Express" forward rates via _shared/rate-cards.ts
// (first 500g + additional 500g, 30% FSC, dead vs L*B*H/5000 whichever higher).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isPartnerEnabled, partnerDisabledResponse } from "../_shared/partner-toggle.ts";
import { quoteFromCard, type PinInfo } from "../_shared/rate-cards.ts";
import { sfxConfigFromRequest, sfxServiceablePins } from "../_shared/shadowfax.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TAT: Record<string, { label: string; days: number }> = {
  intracity: { label: "1-2 Days", days: 2 },
  within_zone: { label: "2-3 Days", days: 3 },
  metro: { label: "3-4 Days", days: 4 },
  roi: { label: "5-6 Days", days: 6 },
  special_zone: { label: "7-8 Days", days: 8 },
};

async function pinInfo(supabase: any, pin: string, city?: string, state?: string): Promise<PinInfo & { known: boolean }> {
  if (city && state) return { pincode: pin, city, state, known: true };
  const { data } = await supabase.from("shadowfax_pincodes").select("city, state").eq("pincode", pin).maybeSingle();
  if (data?.city && data?.state) return { pincode: pin, city: data.city, state: data.state, known: true };
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const po = j?.[0]?.PostOffice?.[0];
    if (po?.State) return { pincode: pin, city: po.District || po.Block || "", state: po.State, known: true };
  } catch { /* ignore */ }
  return { pincode: pin, city: "", state: "", known: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isPartnerEnabled("shadowfax"))) return partnerDisabledResponse("shadowfax", corsHeaders);

  try {
    const body = await req.json();
    const pickup_pincode = String(body.pickup_pincode || "").trim();
    const delivery_pincode = String(body.delivery_pincode || "").trim();
    const weight_kg = Number(body.weight_kg) || 1;
    const dims = { length: Number(body.length_cm) || 10, width: Number(body.width_cm) || 10, height: Number(body.height_cm) || 10 };
    if (!/^[1-9]\d{5}$/.test(pickup_pincode) || !/^[1-9]\d{5}$/.test(delivery_pincode)) {
      return json({ error: "Valid 6-digit pickup_pincode and delivery_pincode are required" }, 400);
    }

    const { base, token, env } = sfxConfigFromRequest(req);
    if (!token) return json({ is_serviceable: false, error: "Shadowfax token not configured" });

    const pins = pickup_pincode === delivery_pincode ? [pickup_pincode] : [pickup_pincode, delivery_pincode];
    const { serviceable, apiOk, result } = await sfxServiceablePins(base, token, pins);
    if (!apiOk) {
      console.warn("[shadowfax-serviceability] API not usable:", result.status, result.raw.slice(0, 300));
      return json({ is_serviceable: false, error: "Shadowfax serviceability unavailable", details: result.data });
    }
    const pickupOk = serviceable.has(pickup_pincode);
    const deliveryOk = serviceable.has(delivery_pincode);
    if (!pickupOk || !deliveryOk) {
      return json({ is_serviceable: false, pickup_serviceable: pickupOk, delivery_serviceable: deliveryOk });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [p, d] = await Promise.all([
      pinInfo(supabase, pickup_pincode, body.pickup_city, body.pickup_state),
      pinInfo(supabase, delivery_pincode, body.delivery_city, body.delivery_state),
    ]);
    // Unknown state → can't rule out the special zone; price at the highest slab rather than under-charge.
    const quote = quoteFromCard("shadowfax", "standard",
      p.known ? p : { pincode: pickup_pincode, state: "assam" },
      d.known ? d : { pincode: delivery_pincode, state: "assam" },
      weight_kg, dims, { sfxTier: "standard" });
    if (!quote) return json({ is_serviceable: false, error: "No rate card entry" });

    const zone = String(quote.zone);
    const tat = TAT[zone] || TAT.roi;
    const amount = Math.round(quote.total ?? quote.price ?? 0);

    return json({
      is_serviceable: true,
      partner: {
        partner_id: "shadowfax_direct",
        partner_code: "shadowfax",
        partner_name: "Shadowfax",
        is_serviceable: true,
        rating: 4.2,
        services: [{
          service_code: "sfx_standard",
          service_name: "Shadowfax Standard",
          tat_days: tat.days,
          tat_label: tat.label,
          delivery_modes: { express: false, standard: true },
          is_cod: false,
          pickup: true,
          delivery: true,
          insurance: false,
          rate: {
            rate_id: "sfx_rate_standard",
            price: { amount, currency: "INR", type: "rate_card" },
            description: `Forward Standard (${zone.replace("_", " ")})`,
          },
        }],
        metadata: { zone, environment: env, pickup_city: p.city, delivery_city: d.city, pickup_state: p.state, delivery_state: d.state, zone_estimated: !(p.known && d.known) },
      },
    });
  } catch (err) {
    console.error("[shadowfax-serviceability] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
