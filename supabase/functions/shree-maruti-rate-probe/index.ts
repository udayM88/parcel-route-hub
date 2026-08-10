// TEMP diagnostic: probes the Innofulfill gateway rate v2 with the Api-Key
// header across several payload variants, to find the shape the rate engine
// accepts once a COURIER rate card is assigned to the tenant.
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { quoteFromCard, type PinInfo } from "../_shared/rate-cards.ts";

const GATEWAY = "https://apis.innofulfill.com";
const V2_URL = `${GATEWAY}/gateway/ure/api/external/rate-calculation/calculate/v2`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

async function pinInfo(pin: string): Promise<PinInfo> {
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const j = await r.json();
    const po = j?.[0]?.PostOffice?.[0];
    if (po) return { pincode: pin, city: po.District || po.Name || "", state: po.State || "" };
  } catch (_) { /* ignore */ }
  return { pincode: pin };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const env = getEnvironmentFromRequest(req);
    const b = await req.json().catch(() => ({}));
    const pickup = String(b.pickup_pincode ?? "364003");
    const delivery = String(b.delivery_pincode ?? "400059");
    const weight = Number(b.weight_kg ?? 1);
    const mode = String(b.mode ?? "SURFACE").toUpperCase();
    const dims = {
      l: Number(b.length_cm ?? 10),
      w: Number(b.width_cm ?? 10),
      h: Number(b.height_cm ?? 10),
    };

    const apiKey = Deno.env.get("SHREE_MARUTI_INNO_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "SHREE_MARUTI_INNO_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader: Record<string, string> = { "Api-Key": apiKey };

    const base = {
      fromPincode: Number(pickup),
      toPincode: Number(delivery),
      weight: Math.round(weight * 1000),
      length: dims.l, width: dims.w, height: dims.h,
      deliveryMode: mode,
      isCodOrder: false,
      codAmount: 0,
      declaredValue: 1000,
    };

    const variants: Array<{ name: string; body: Record<string, unknown> }> = [
      { name: "base", body: base },
      { name: "rateCardType=COURIER", body: { ...base, rateCardType: "COURIER" } },
      { name: "serviceType=COURIER", body: { ...base, serviceType: "COURIER" } },
      { name: "shipmentType=FORWARD", body: { ...base, rateCardType: "COURIER", shipmentType: "FORWARD" } },
      { name: "paymentType=PREPAID", body: { ...base, rateCardType: "COURIER", paymentType: "PREPAID" } },
      { name: "weight-in-kg", body: { ...base, weight } },
    ];

    const attempts: any[] = [];
    for (const v of variants) {
      try {
        const r = await fetch(V2_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeader },
          body: JSON.stringify(v.body),
        });
        const t = await r.text();
        attempts.push({ variant: v.name, status: r.status, body: t.slice(0, 700) });
        if (r.ok) break;
      } catch (e) {
        attempts.push({ variant: v.name, error: String(e) });
      }
    }

    // Also probe a couple of discovery endpoints to see what the key can read.
    const discovery: any[] = [];
    for (const p of [
      "/gateway/ure/api/external/rate-calculation/rate-cards",
      "/gateway/ure/api/external/rate-card/list",
      "/gateway/ure/api/external/profile",
    ]) {
      try {
        const r = await fetch(`${GATEWAY}${p}`, { headers: { Accept: "application/json", ...authHeader } });
        const t = await r.text();
        discovery.push({ path: p, status: r.status, body: t.slice(0, 400) });
      } catch (e) {
        discovery.push({ path: p, error: String(e) });
      }
    }

    const [pi, di] = await Promise.all([pinInfo(pickup), pinInfo(delivery)]);
    const card = quoteFromCard(
      "shree_maruti",
      mode === "AIR" ? "air" : "surface",
      pi, di, weight, dims,
    );

    return new Response(JSON.stringify({ env, card, attempts, discovery }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
