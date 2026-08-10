// TEMP diagnostic: calls the LIVE Shree Maruti v2 rate API (Innofulfill gateway)
// and compares it with the embedded contracted rate card. Not used by the app.
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { shreeMarutiFetch } from "../_shared/shree-maruti-auth.ts";
import { quoteFromCard, type PinInfo } from "../_shared/rate-cards.ts";

const V2_URL = "https://apis.innofulfill.com/gateway/ure/api/external/rate-calculation/calculate/v2";

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
    const b = await req.json();
    const pickup = String(b.pickup_pincode);
    const delivery = String(b.delivery_pincode);
    const weight = Number(b.weight_kg ?? 1);
    const mode = String(b.mode ?? "SURFACE").toUpperCase();
    const dims = { l: Number(b.length_cm ?? 10), w: Number(b.width_cm ?? 10), h: Number(b.height_cm ?? 10) };

    const attempts: any[] = [];
    const payloads: Record<string, unknown>[] = [
      {
        fromPincode: Number(pickup), toPincode: Number(delivery),
        weight: Math.round(weight * 1000), deliveryMode: mode,
        isCodOrder: false, codAmount: 0, declaredValue: 1000,
        length: dims.l, width: dims.w, height: dims.h,
      },
      {
        fromPincode: Number(pickup), toPincode: Number(delivery),
        weight, deliveryMode: mode, isCodOrder: false, codAmount: 0,
        declaredValue: 1000,
        length: dims.l, width: dims.w, height: dims.h,
        paymentType: "ONLINE", shipmentType: "FORWARD",
      },
      {
        fromPincode: String(pickup), toPincode: String(delivery),
        weight: Math.round(weight * 1000), deliveryMode: mode,
        isCodOrder: false, codAmount: 0, declaredValue: 1000,
        length: dims.l, width: dims.w, height: dims.h,
        orderType: "ECOMM", serviceType: mode,
      },
    ];
    for (const p of payloads) {
      try {
        const res = await shreeMarutiFetch(env, V2_URL, {
          method: "POST", body: JSON.stringify(p),
        });
        const text = await res.text();
        attempts.push({ payload: p, status: res.status, body: text.slice(0, 2000) });
      } catch (e) {
        attempts.push({ payload: p, error: String(e) });
      }
    }

    const [pi, di] = await Promise.all([pinInfo(pickup), pinInfo(delivery)]);
    const card = quoteFromCard("shree_maruti", mode === "AIR" ? "air" : "surface", pi, di, weight, dims);

    return new Response(JSON.stringify({ card, attempts }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
