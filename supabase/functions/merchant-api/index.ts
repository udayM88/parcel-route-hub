// ViaSetu Merchant Shipping API — single endpoint for business customers' websites.
//
// Auth:  Authorization: Bearer vs_live_xxx   (or vs_test_xxx for sandbox)
// Body:  POST JSON { action, ... }
//   rates            { pickup_pincode, delivery_pincode, boxes:[{weight_kg,length_cm,width_cm,height_cm}] }
//   create_shipment  { pickup:{...}, delivery:{...}, boxes, partner_code?, service_code?, goods_type?, declared_value? }
//                    header Idempotency-Key required. Charged from the prepaid wallet.
//   track            { booking_id | awb }
//   label            { booking_id, box_index? }
//   cancel           { booking_id, reason? }
//   wallet           {}  -> current balance
// Prices are always computed server-side (courier rate + business margin, 18% GST on top).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePartnerKey } from "../_shared/partner-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, idempotency-key, x-client-info, apikey",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const err = (code: string, message: string, status = 400, extra: Record<string, unknown> = {}) =>
  json({ success: false, error: { code, message, ...extra } }, status);

const BUSINESS_FLAT_MARGIN = 15;
const GST_RATE = 0.18;
const PARTNERS = [
  { code: "shadowfax", fn: "shadowfax-serviceability" },
  { code: "delhivery", fn: "delhivery-serviceability" },
  { code: "urbanebolt", fn: "urbanebolt-serviceability" },
  { code: "xpressbees", fn: "xpressbees-serviceability" },
  { code: "shree_maruti", fn: "shree-maruti-serviceability" },
];

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Box = { weight_kg: number; length_cm?: number; width_cm?: number; height_cm?: number };

function parseBoxes(raw: unknown): Box[] | string {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) return "boxes must contain 1-50 entries";
  const out: Box[] = [];
  for (const b of raw as any[]) {
    const w = Number(b?.weight_kg);
    if (!(w > 0 && w <= 100)) return "each box needs weight_kg between 0 and 100";
    const dim = (v: unknown) => (v == null ? undefined : Number(v) > 0 && Number(v) <= 300 ? Number(v) : NaN);
    const l = dim(b.length_cm), wd = dim(b.width_cm), h = dim(b.height_cm);
    if ([l, wd, h].some((x) => Number.isNaN(x))) return "dimensions must be between 0 and 300 cm";
    // Chargeable weight: max(dead, volumetric /5000)
    const vol = l && wd && h ? (l * wd * h) / 5000 : 0;
    out.push({ weight_kg: Math.max(w, vol), length_cm: l, width_cm: wd, height_cm: h });
  }
  return out;
}

export function priceFor(rates: number[]) {
  const nets = rates.map((r) => Math.round(r) + BUSINESS_FLAT_MARGIN);
  const net = nets.reduce((a, b) => a + b, 0);
  const total = Math.round(net * (1 + GST_RATE));
  return { net, gst: total - net, total };
}

async function quote(url: string, anonKey: string, env: string, pickup: string, delivery: string, boxes: Box[]) {
  const perBox = await Promise.all(boxes.map(async (b) => {
    const payload = {
      pickup_pincode: pickup, delivery_pincode: delivery, weight_kg: b.weight_kg,
      length_cm: b.length_cm || 10, width_cm: b.width_cm || 10, height_cm: b.height_cm || 10,
    };
    const settled = await Promise.allSettled(PARTNERS.map(async (p) => {
      const r = await fetch(`${url}/functions/v1/${p.fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey, "x-environment": env },
        body: JSON.stringify(payload),
      });
      return { code: p.code, data: await r.json().catch(() => null) };
    }));
    const map = new Map<string, { partner: any; service: any; code: string }>();
    for (const s of settled) {
      if (s.status !== "fulfilled") continue;
      const d = s.value.data;
      if (!d?.is_serviceable || !d?.partner) continue;
      for (const svc of d.partner.services || []) {
        map.set(`${s.value.code}::${svc.service_code}`, { partner: d.partner, service: svc, code: s.value.code });
      }
    }
    return map;
  }));
  const quotes: any[] = [];
  perBox[0].forEach((entry, key) => {
    const rates: number[] = [];
    for (const m of perBox) {
      const hit = m.get(key);
      if (!hit) return;
      rates.push(Math.round(hit.service.rate?.price?.amount || 0));
    }
    if (rates.some((r) => !(r > 0))) return;
    const p = priceFor(rates);
    quotes.push({
      partner_code: entry.code,
      partner_id: entry.partner.partner_id,
      partner_name: entry.partner.partner_name,
      service_code: entry.service.service_code,
      service_name: entry.service.service_name || "Standard",
      delivery_time: entry.service.delivery_label || (entry.service.tat_days ? `${entry.service.tat_days} days` : "2-5 days"),
      amount_excl_gst: p.net, gst: p.gst, total_amount: p.total, currency: "INR",
      _box_rates: rates,
    });
  });
  quotes.sort((a, b) => a.total_amount - b.total_amount);
  return quotes;
}

const pub = (q: any) => { const { _box_rates, partner_id, ...rest } = q; return rest; };

function party(p: any, label: string): any | string {
  const f = ["name", "phone", "address", "city", "state", "pincode"];
  for (const k of f) if (!p?.[k] || String(p[k]).trim() === "") return `${label}.${k} is required`;
  if (!/^\d{6}$/.test(String(p.pincode))) return `${label}.pincode must be 6 digits`;
  const phone = String(p.phone).replace(/\D/g, "").slice(-10);
  if (!/^\d{10}$/.test(phone)) return `${label}.phone must be 10 digits`;
  return { ...p, phone, pincode: String(p.pincode), name: String(p.name).slice(0, 100), address: String(p.address).slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return err("method_not_allowed", "Use POST", 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey);

    const key = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!/^vs_(live|test)_[0-9a-f]{48}$/.test(key)) return err("unauthorized", "Missing or malformed API key", 401);
    const { data: apiKey } = await admin.from("business_api_keys")
      .select("id,business_account_id,environment,revoked_at").eq("key_hash", await sha256Hex(key)).maybeSingle();
    if (!apiKey || apiKey.revoked_at) return err("unauthorized", "Invalid or revoked API key", 401);
    const { data: biz } = await admin.from("business_accounts")
      .select("id,user_id,status,is_active").eq("id", apiKey.business_account_id).maybeSingle();
    if (!biz || !biz.is_active || biz.status !== "approved") return err("forbidden", "Business account is not active", 403);
    admin.from("business_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id).then(() => {});
    const env = apiKey.environment === "live" ? "production" : "sandbox";

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("invalid_json", "Body must be a JSON object");
    const action = String(body.action || "");

    if (action === "wallet") {
      const { data } = await admin.from("business_wallets").select("balance").eq("business_account_id", biz.id).maybeSingle();
      return json({ success: true, balance: Number(data?.balance ?? 0), currency: "INR" });
    }

    if (action === "rates") {
      const boxes = parseBoxes(body.boxes);
      if (typeof boxes === "string") return err("validation_error", boxes);
      if (!/^\d{6}$/.test(String(body.pickup_pincode)) || !/^\d{6}$/.test(String(body.delivery_pincode))) {
        return err("validation_error", "pickup_pincode and delivery_pincode must be 6 digits");
      }
      const q = await quote(url, anonKey, env, String(body.pickup_pincode), String(body.delivery_pincode), boxes);
      return json({ success: true, quotes: q.map(pub) });
    }

    if (action === "create_shipment") {
      const idem = (req.headers.get("Idempotency-Key") || "").trim();
      if (idem.length < 8 || idem.length > 100) return err("idempotency_key_required", "Send a unique Idempotency-Key header (8-100 chars)");
      const { data: prior } = await admin.from("merchant_api_requests")
        .select("response,status_code").eq("api_key_id", apiKey.id).eq("idempotency_key", idem).maybeSingle();
      if (prior) {
        if (prior.response) return json(prior.response, prior.status_code || 200);
        return err("in_progress", "A request with this Idempotency-Key is still processing", 409);
      }
      const pickup = party(body.pickup, "pickup");
      if (typeof pickup === "string") return err("validation_error", pickup);
      const delivery = party(body.delivery, "delivery");
      if (typeof delivery === "string") return err("validation_error", delivery);
      const boxes = parseBoxes(body.boxes);
      if (typeof boxes === "string") return err("validation_error", boxes);

      const { error: claimErr } = await admin.from("merchant_api_requests")
        .insert({ api_key_id: apiKey.id, idempotency_key: idem, action });
      if (claimErr) return err("in_progress", "A request with this Idempotency-Key is already processing", 409);

      const finish = async (payload: any, status: number, bookingId?: string) => {
        await admin.from("merchant_api_requests").update({ response: payload, status_code: status, booking_id: bookingId ?? null })
          .eq("api_key_id", apiKey.id).eq("idempotency_key", idem);
        return json(payload, status);
      };

      const quotes = await quote(url, anonKey, env, pickup.pincode, delivery.pincode, boxes);
      const chosen = body.partner_code
        ? quotes.find((q) => q.partner_code === body.partner_code && (!body.service_code || q.service_code === body.service_code))
        : quotes[0];
      if (!chosen) {
        return finish({ success: false, error: { code: "not_serviceable", message: "No courier serves this route for the requested service" } }, 422);
      }

      const res = await fetch(`${url}/functions/v1/business-create-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, "x-internal-key": serviceKey, "x-environment": env },
        body: JSON.stringify({
          _business_account_id: biz.id, _pay_with_wallet: true,
          sender_name: pickup.name, sender_phone: pickup.phone, sender_address: pickup.address,
          sender_city: pickup.city, sender_state: pickup.state, sender_pincode: pickup.pincode,
          receiver_name: delivery.name, receiver_phone: delivery.phone, receiver_address: delivery.address,
          receiver_city: delivery.city, receiver_state: delivery.state, receiver_pincode: delivery.pincode,
          goods_type: String(body.goods_type || "Package").slice(0, 60),
          shipment_value: Number(body.declared_value) > 0 ? Number(body.declared_value) : null,
          courier_name: `${chosen.partner_name} - ${chosen.service_name}`,
          partner_id: chosen.partner_id, service_code: chosen.service_code, delivery_time: chosen.delivery_time,
          boxes: boxes.map((b, i) => ({ ...b, courier_rate: chosen._box_rates[i] })),
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.status === 402) {
        return finish({ success: false, error: { code: "insufficient_balance", message: "Wallet balance is too low. Please top up.", balance: out.balance, required: out.required } }, 402, out.booking_id);
      }
      if (!res.ok && !out?.booking_id) {
        return finish({ success: false, error: { code: "booking_failed", message: out?.error || "Could not create shipment" } }, 502);
      }
      const payload = {
        success: !!out.success,
        booking_id: out.booking_id,
        status: out.booking?.status,
        courier: chosen.partner_name, service: chosen.service_name,
        total_amount: out.total_amount, wallet_refunded: out.wallet_refunded || 0,
        boxes: (out.boxes || []).map((b: any) => ({ box_index: b.box_index, success: b.success, awb: b.tracking_id, error: b.success ? undefined : b.error })),
        ...(out.success ? {} : { error: { code: "courier_rejected", message: "Courier could not accept the shipment. Amount refunded to wallet." } }),
      };
      return finish(payload, out.success ? 201 : 502, out.booking_id);
    }

    // Lookups scoped to this business.
    const findBooking = async () => {
      let q = admin.from("bookings").select("*").eq("business_account_id", biz.id);
      if (body.booking_id && /^[0-9a-f-]{36}$/i.test(String(body.booking_id))) q = q.eq("id", body.booking_id);
      else if (body.awb && /^[A-Za-z0-9-]{4,40}$/.test(String(body.awb))) q = q.or(`tracking_id.eq.${body.awb},prayog_awb.eq.${body.awb}`);
      else return null;
      const { data } = await q.maybeSingle();
      return data;
    };

    if (action === "track") {
      const b = await findBooking();
      if (!b) return err("not_found", "Shipment not found", 404);
      const [{ data: boxes }, { data: events }] = await Promise.all([
        admin.from("booking_boxes").select("box_index,tracking_id,status").eq("booking_id", b.id).order("box_index"),
        admin.from("shipment_status_events").select("normalized_status,raw_status,event_time,awb")
          .eq("booking_id", b.id).order("event_time", { ascending: false }).limit(50),
      ]);
      return json({
        success: true, booking_id: b.id, status: b.status, courier: b.courier_name, awb: b.tracking_id,
        created_at: b.created_at, updated_at: b.updated_at,
        boxes: (boxes || []).map((x: any) => ({ box_index: x.box_index, awb: x.tracking_id, status: x.status })),
        events: events || [],
      });
    }

    if (action === "label") {
      const b = await findBooking();
      if (!b) return err("not_found", "Shipment not found", 404);
      let boxId: string | undefined;
      if (body.box_index) {
        const { data: bx } = await admin.from("booking_boxes").select("id").eq("booking_id", b.id).eq("box_index", Number(body.box_index)).maybeSingle();
        if (!bx) return err("not_found", "Box not found", 404);
        boxId = bx.id;
      }
      const r = await fetch(`${url}/functions/v1/get-booking-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, "x-environment": env, "x-prayog-auth": JSON.stringify({ user_id: biz.user_id }) },
        body: JSON.stringify({ booking_id: b.id, box_id: boxId }),
      });
      const out = await r.json().catch(() => ({}));
      if (!out?.success || !out.label_url) return err("label_unavailable", out?.error || "Label not available yet", 404);
      return json({ success: true, label_url: out.label_url });
    }

    if (action === "cancel") {
      const b = await findBooking();
      if (!b) return err("not_found", "Shipment not found", 404);
      const st = String(b.status || "").toUpperCase();
      if (!["CREATED", "CONFIRMED", "PAYMENT_RECEIVED", "PENDING_PICKUP", "MANIFESTED", "ORDER_PLACED"].includes(st)) {
        return err("not_cancellable", `Shipment in status ${b.status} can't be cancelled`, 409);
      }
      const key = resolvePartnerKey(b.partner_id, b.courier_name, b.booking_source);
      if (!key) return err("not_cancellable", "Courier does not support online cancellation", 409);
      const reason = String(body.reason || "Cancelled by merchant").slice(0, 200);
      const awb = b.prayog_awb || b.tracking_id;
      const fn = `${key.replace(/_/g, "-")}-cancel-order`;
      const payload = key === "shadowfax" ? { client_order_id: b.prayog_order_id || b.id, awb, cancel_remarks: reason, booking_id: b.id }
        : key === "shree_maruti" ? { order_id: b.prayog_order_id || b.id, cancel_remarks: reason, booking_id: b.id }
        : { waybill: awb, cancel_remarks: reason, booking_id: b.id };
      if (key !== "shree_maruti" && key !== "shadowfax" && !awb) return err("not_cancellable", "AWB missing", 409);
      const r = await fetch(`${url}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, "x-environment": env, "x-prayog-auth": JSON.stringify({ user_id: biz.user_id }) },
        body: JSON.stringify(payload),
      });
      const out = await r.json().catch(() => ({}));
      if (!out?.success) return err("cancel_failed", out?.error || out?.message || "Courier rejected the cancellation", 502);
      return json({ success: true, booking_id: b.id, status: "CANCELLED", message: "Cancelled. Refund credited to wallet." });
    }

    return err("unknown_action", "action must be one of rates, create_shipment, track, label, cancel, wallet");
  } catch (e) {
    console.error("[merchant-api]", e);
    return err("internal_error", "Unexpected error", 500);
  }
});
