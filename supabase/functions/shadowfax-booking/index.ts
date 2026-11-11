// Shadowfax Marketplace 360 — forward order booking.
// Single parcel: POST /v3/clients/orders/ (order_type marketplace, prepaid).
// Multi-parcel: POST /v2/clients/orders/ (MPS) with package_details → one parent AWB
// plus one child AWB per box. Rejections arrive as HTTP 200 + message "Failure".
import { sfxAccepted, sfxConfigFromRequest, sfxError, sfxFetch } from "../_shared/shadowfax.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment, x-internal-key, x-prayog-auth",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const num = (v: any, f = 0) => { const n = typeof v === "string" ? parseFloat(v) : Number(v); return Number.isFinite(n) ? n : f; };
const phone = (v: any) => String(v || "").replace(/\D/g, "").slice(-10);
const pin = (v: any) => parseInt(String(v || "").replace(/\D/g, ""), 10) || 0;
const volKg = (l: number, w: number, h: number) => Math.round(((l * w * h) / 5000) * 1000) / 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { base, token } = sfxConfigFromRequest(req);
    if (!token) return json({ success: false, error: "Shadowfax API token not configured" }, 500);

    const b = await req.json();
    const required = ["order_id", "sender_name", "sender_phone", "sender_address", "sender_pincode", "receiver_name", "receiver_phone", "receiver_address", "receiver_pincode"];
    const missing = required.filter((k) => !String(b[k] ?? "").trim());
    if (missing.length) return json({ success: false, error: `Missing required fields: ${missing.join(", ")}` }, 400);
    if (phone(b.sender_phone).length !== 10 || phone(b.receiver_phone).length !== 10) {
      return json({ success: false, error: "Sender and receiver phone must be 10 digits" }, 400);
    }

    const orderId = String(b.order_id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
    const value = Math.max(1, num(b.shipment_value, 0));
    if (value >= 50000) return json({ success: false, error: "Shipments worth ₹50,000 or more need an e-way bill; book manually." }, 400);

    const seller = {
      name: String(b.sender_name).slice(0, 100),
      contact: phone(b.sender_phone),
      address_line_1: String(b.sender_address).slice(0, 250),
      city: String(b.sender_city || "").slice(0, 50) || "NA",
      pincode: pin(b.sender_pincode),
    };
    const boxes: any[] = Array.isArray(b.boxes) ? b.boxes.filter(Boolean) : [];
    const isMps = boxes.length > 1;

    const weightKg = num(b.package_weight, 0.5);
    const L = num(b.length, 10), W = num(b.width, 10), H = num(b.height, 10);
    const totalActual = isMps ? boxes.reduce((s, x) => s + num(x.weight_kg, 0.5), 0) : weightKg;
    const totalVol = isMps
      ? boxes.reduce((s, x) => s + volKg(num(x.length_cm, 10), num(x.width_cm, 10), num(x.height_cm, 10)), 0)
      : volKg(L, W, H);

    const payload: Record<string, unknown> = {
      order_type: "marketplace",
      customer_details: {
        name: String(b.receiver_name).slice(0, 100),
        contact: phone(b.receiver_phone),
        address_line_1: String(b.receiver_address).slice(0, 250),
        city: String(b.receiver_city || "").slice(0, 50) || "NA",
        state: String(b.receiver_state || "").slice(0, 40) || undefined,
        pincode: pin(b.receiver_pincode),
      },
      order_details: {
        client_order_id: orderId,
        product_value: value,
        payment_mode: "prepaid",
        cod_amount: 0,
        order_service: "Regular",
        actual_weight: Math.round(totalActual * 1000) / 1000,
        volumetric_weight: Math.round(totalVol * 1000) / 1000,
        ...(isMps ? { package_count: boxes.length } : {}),
      },
      pickup_details: { pickup_type: "seller", ...seller },
      return_details: { return_type: "seller", ...seller },
      product_details: [{
        sku_name: String(b.goods_type || "Package").slice(0, 100),
        sku_id: orderId,
        price: value,
        category: String(b.goods_type || "General").slice(0, 200),
        invoice_no: orderId.slice(0, 50),
      }],
    };
    if (isMps) {
      const per = Math.round((value / boxes.length) * 100) / 100;
      payload.package_details = boxes.map((x, i) => ({
        package_id: `${orderId}-${String(x.box_index ?? i + 1).padStart(2, "0")}`,
        actual_weight: num(x.weight_kg, 0.5),
        volumetric_weight: volKg(num(x.length_cm, 10), num(x.width_cm, 10), num(x.height_cm, 10)),
        product_value: per,
      }));
    }

    const path = isMps ? "/v2/clients/orders/" : "/v3/clients/orders/";
    console.log(`[shadowfax-booking] POST ${path}`, JSON.stringify(payload));
    const r = await sfxFetch(base, token, path, { body: payload, timeoutMs: 30000 });
    console.log("[shadowfax-booking] response:", r.status, r.raw.slice(0, 2000));

    const data = r.data?.data || r.data || {};
    const awb = data.awb_number || r.data?.awb_number;
    if (!sfxAccepted(r) && !(r.ok && awb && !String(r.data?.message || "").toLowerCase().includes("fail"))) {
      return json({ success: false, step: "create_order", error: sfxError(r), shadowfax_response: r.data }, r.ok ? 422 : (r.status || 502));
    }
    if (!awb) return json({ success: false, step: "create_order", error: "Shadowfax returned no AWB", shadowfax_response: r.data }, 502);

    const pkg: any[] = Array.isArray(data.package_details) ? data.package_details : (r.data?.package_details || []);
    const packages = pkg.map((p: any, i: number) => ({
      box_index: boxes[i]?.box_index ?? i + 1,
      package_id: p.package_id,
      awb_number: p.awb_number || p.awb || null,
    }));

    return json({
      success: true,
      orderId,               // Shadowfax keys orders by our client_order_id
      awbNumber: String(awb),
      partnerOrderId: data.id ? String(data.id) : orderId,
      packages,
      status: data.status || "new",
      shadowfax_response: r.data,
    });
  } catch (err) {
    console.error("[shadowfax-booking] error:", err);
    return json({ success: false, error: "Internal server error", details: String(err) }, 500);
  }
});
