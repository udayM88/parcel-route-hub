// TEMP diagnostic: probes auth + rate v2 on the Innofulfill gateway.
import { getShreeMarutiConfig, getEnvironmentFromRequest } from "../_shared/environment.ts";
import { getShreeMarutiToken } from "../_shared/shree-maruti-auth.ts";
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

    const { email, password, vendorType } = getShreeMarutiConfig(env);
    const logins: any[] = [];
    const tokens: Record<string, string> = {};

    // Delcaper token (known working for other endpoints)
    try { tokens["delcaper"] = await getShreeMarutiToken(env); } catch (e) { logins.push({ where: "delcaper", error: String(e) }); }

    // Try login endpoints on innofulfill gateway
    const loginUrls = [
      "https://apis.innofulfill.com/auth/login",
      "https://apis.innofulfill.com/gateway/ure/api/external/auth/login",
      "https://apis.innofulfill.com/gateway/auth/login",
    ];
    for (const u of loginUrls) {
      try {
        const r = await fetch(u, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(u.includes("innofulfill.com/auth/login") ? { username: email, password } : { email, password, vendorType }),
        });
        const t = await r.text();
        logins.push({ url: u, status: r.status, body: t.slice(0, 600) });
        try {
          const j = JSON.parse(t);
          const tok = j?.data?.accessToken || j?.accessToken || j?.data?.token || j?.token;
          if (tok) tokens[u] = tok;
        } catch (_) { /* ignore */ }
      } catch (e) { logins.push({ url: u, error: String(e) }); }
    }

    const payload = {
      fromPincode: Number(pickup), toPincode: Number(delivery),
      weight: Math.round(weight * 1000), deliveryMode: mode,
      isCodOrder: false, codAmount: 0, declaredValue: 1000,
      length: dims.l, width: dims.w, height: dims.h,
    };

    const attempts: any[] = [];
    for (const [name, tok] of Object.entries(tokens)) {
      const headerSets: Record<string, string>[] = [
        { Authorization: `Bearer ${tok}` },
        { Authorization: tok },
        { token: tok },
        { "x-access-token": tok },
      ];
      for (const h of headerSets) {
        try {
          const r = await fetch(V2_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...h },
            body: JSON.stringify(payload),
          });
          const t = await r.text();
          attempts.push({ token: name, header: Object.keys(h)[0], status: r.status, body: t.slice(0, 800) });
          if (r.ok) break;
        } catch (e) { attempts.push({ token: name, header: Object.keys(h)[0], error: String(e) }); }
      }
    }

    const [pi, di] = await Promise.all([pinInfo(pickup), pinInfo(delivery)]);
    const card = quoteFromCard("shree_maruti", mode === "AIR" ? "air" : "surface", pi, di, weight, dims);

    return new Response(JSON.stringify({ card, logins, attempts }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
