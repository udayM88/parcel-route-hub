// Business (ViaSetu for Businesses) multi-box shipment creation.
//
// Auth: Supabase JWT of a business user with an approved, active
// business_accounts row.
//
// Flow: create the bookings row (account_type='business', box_count=N),
// create one booking_boxes row per box, then fire the partner booking edge
// function once per box so every box gets its own AWB / label.
//
// Pricing: (courier rate + ₹15 internal margin) per box, plus 18% GST on top.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const BUSINESS_FLAT_MARGIN = 15;
const GST_RATE = 0.18;

function pickPartnerFn(partnerId: string, courierName: string): string | null {
  const pid = String(partnerId || "").toLowerCase();
  if (pid.startsWith("shadowfax")) return "shadowfax-booking";
  if (pid.startsWith("delhivery")) return "delhivery-booking";
  if (pid.startsWith("urbanebolt")) return "urbanebolt-booking";
  if (pid.startsWith("xpressbees")) return "xpressbees-booking";
  if (pid.startsWith("shree_maruti")) return "shree-maruti-booking";

  const name = String(courierName || "").toLowerCase();
  if (name.includes("shadowfax")) return "shadowfax-booking";
  if (name.includes("delhivery")) return "delhivery-booking";
  if (name.includes("urbanebolt") || name.includes("urbane bolt")) return "urbanebolt-booking";
  if (name.includes("xpressbees")) return "xpressbees-booking";
  if (name.includes("maruti")) return "shree-maruti-booking";
  return null;
}

function genOrderId(suffix: number): string {
  const now = new Date();
  const ts = [
    now.getFullYear().toString().slice(-2),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0"),
  ].join("");
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = Array.from({ length: 4 }, () => cs[Math.floor(Math.random() * cs.length)]).join("");
  return `${ts}${rand}${suffix}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type BoxInput = {
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  courier_rate: number;
};

function validate(body: any): { ok: true; data: any } | { ok: false; error: string } {
  const required = [
    "sender_name", "sender_phone", "sender_address", "sender_city", "sender_state", "sender_pincode",
    "receiver_name", "receiver_phone", "receiver_address", "receiver_city", "receiver_state", "receiver_pincode",
    "courier_name",
  ];
  for (const f of required) {
    if (!body?.[f] || String(body[f]).trim() === "") return { ok: false, error: `Missing field: ${f}` };
  }
  for (const f of ["sender_pincode", "receiver_pincode"]) {
    if (!/^\d{6}$/.test(String(body[f]))) return { ok: false, error: `${f} must be a 6-digit pincode` };
  }
  for (const f of ["sender_phone", "receiver_phone"]) {
    if (!/^\d{10}$/.test(String(body[f]).replace(/\D/g, "").slice(-10))) {
      return { ok: false, error: `${f} must be a 10-digit phone number` };
    }
  }
  const boxes = Array.isArray(body?.boxes) ? body.boxes : [];
  if (boxes.length < 1 || boxes.length > 50) return { ok: false, error: "boxes must contain 1-50 entries" };
  for (const b of boxes) {
    if (!(Number(b?.weight_kg) > 0)) return { ok: false, error: "Each box needs a weight in kg" };
    if (!(Number(b?.courier_rate) >= 0)) return { ok: false, error: "Each box needs a courier rate" };
  }
  return { ok: true, data: { ...body, boxes: boxes as BoxInput[] } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const env = req.headers.get("x-environment") || "production";

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: biz } = await admin
      .from("business_accounts")
      .select("id,company_name,status,is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!biz || biz.status !== "approved") {
      return json({ error: "Business account is not approved for booking yet." }, 403);
    }

    const parsed = validate(await req.json());
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const b = parsed.data;
    const boxes: BoxInput[] = b.boxes;

    // ── Pricing: (rate + ₹15) per box, then 18% GST on top ────────
    const perBox = boxes.map((bx) => {
      const rate = Math.round(Number(bx.courier_rate) || 0);
      const net = rate + BUSINESS_FLAT_MARGIN;
      return { rate, net, price: Math.round(net * (1 + GST_RATE)) };
    });
    const totalRate = perBox.reduce((s, p) => s + p.rate, 0);
    const totalNet = perBox.reduce((s, p) => s + p.net, 0);
    const totalPrice = Math.round(totalNet * (1 + GST_RATE));
    const gst = totalPrice - totalNet;
    const totalWeightKg = boxes.reduce((s, bx) => s + (Number(bx.weight_kg) || 0), 0);


    const { data: booking, error: insErr } = await admin
      .from("bookings")
      .insert({
        user_id: userId,
        business_account_id: biz.id,
        account_type: "business",
        sender_name: b.sender_name,
        sender_phone: String(b.sender_phone).replace(/\D/g, "").slice(-10),
        sender_address: b.sender_address,
        sender_city: b.sender_city,
        sender_state: b.sender_state,
        sender_pincode: String(b.sender_pincode),
        receiver_name: b.receiver_name,
        receiver_phone: String(b.receiver_phone).replace(/\D/g, "").slice(-10),
        receiver_address: b.receiver_address,
        receiver_city: b.receiver_city,
        receiver_state: b.receiver_state,
        receiver_pincode: String(b.receiver_pincode),
        goods_type: b.goods_type || "Package",
        package_weight: String(totalWeightKg),
        length: boxes[0]?.length_cm ? String(boxes[0].length_cm) : null,
        width: boxes[0]?.width_cm ? String(boxes[0].width_cm) : null,
        height: boxes[0]?.height_cm ? String(boxes[0].height_cm) : null,
        shipment_value: b.shipment_value ? Number(b.shipment_value) : null,
        urgency: b.urgency || "standard",
        courier_name: b.courier_name,
        courier_price: totalPrice,
        courier_rate: totalRate,
        retail_price: null,
        margin_amount: totalPrice - totalRate,
        base_fare: totalPrice - gst,
        platform_fee: totalPrice - totalRate,
        gst,
        delivery_time: b.delivery_time || "2-5 days",
        partner_id: b.partner_id || null,
        service_code: b.service_code || null,
        box_count: boxes.length,
        status: "PAYMENT_RECEIVED",
        payment_id: b.payment_id || null,
        payment_status: b.payment_id ? "paid" : "pending",
        booking_source: "business_portal",
      })
      .select()
      .single();

    if (insErr || !booking) {
      console.error("[business-create-shipment] insert failed:", insErr);
      return json({ error: insErr?.message || "Failed to create booking" }, 500);
    }

    const partnerFn = pickPartnerFn(b.partner_id || "", b.courier_name);
    if (!partnerFn) {
      await admin.from("bookings").update({
        status: "FAILED",
        failure_reason: `Unknown partner for courier '${b.courier_name}'`,
      }).eq("id", booking.id);
      return json({ error: `Unknown courier partner '${b.courier_name}'`, booking_id: booking.id }, 400);
    }

    // ── Book each box with the partner ────────────────────────────
    const results: any[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i];
      const orderId = genOrderId(i + 1);

      const { data: boxRow } = await admin.from("booking_boxes").insert({
        booking_id: booking.id,
        box_index: i + 1,
        weight_kg: Number(bx.weight_kg),
        length_cm: bx.length_cm ?? null,
        width_cm: bx.width_cm ?? null,
        height_cm: bx.height_cm ?? null,
        chargeable_weight_kg: Number(bx.weight_kg),
        courier_rate: perBox[i].rate,
        price: perBox[i].price,
        status: "pending",
      }).select().single();

      let ok = false;
      let awb: string | null = null;
      let labelUrl: string | null = null;
      let errorMessage: string | null = null;

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${partnerFn}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            "x-environment": env,
          },
          body: JSON.stringify({
            order_id: orderId,
            sender_name: b.sender_name,
            sender_phone: String(b.sender_phone).replace(/\D/g, "").slice(-10),
            sender_address: b.sender_address,
            sender_pincode: String(b.sender_pincode),
            sender_city: b.sender_city,
            sender_state: b.sender_state,
            receiver_name: b.receiver_name,
            receiver_phone: String(b.receiver_phone).replace(/\D/g, "").slice(-10),
            receiver_address: b.receiver_address,
            receiver_pincode: String(b.receiver_pincode),
            receiver_city: b.receiver_city,
            receiver_state: b.receiver_state,
            package_weight: Number(bx.weight_kg),
            goods_type: b.goods_type || "Package",
            shipment_value: b.shipment_value ? Number(b.shipment_value) : 0,
            length: Number(bx.length_cm) || 10,
            width: Number(bx.width_cm) || 10,
            height: Number(bx.height_cm) || 10,
            service_code: b.service_code || undefined,
          }),
        });
        const text = await res.text();
        let payload: any;
        try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

        if (res.ok && payload?.success) {
          ok = true;
          awb = payload.awbNumber || payload.awb_number || payload.orderId || orderId;
          labelUrl = payload.label_url || payload.labelUrl || null;
        } else {
          errorMessage = String(payload?.error || payload?.message || text).slice(0, 400);
        }
      } catch (e) {
        errorMessage = String((e as Error)?.message || e).slice(0, 400);
      }

      await admin.from("booking_boxes").update({
        status: ok ? "booked" : "failed",
        tracking_id: awb,
        partner_order_id: orderId,
        label_url: labelUrl,
        error_message: errorMessage,
      }).eq("id", boxRow?.id ?? "");

      results.push({ box_index: i + 1, success: ok, tracking_id: awb, label_url: labelUrl, error: errorMessage });
    }

    const booked = results.filter((r) => r.success);
    const firstOk = booked[0];

    const { data: updated } = await admin.from("bookings").update({
      status: booked.length === 0 ? "FAILED" : "CREATED",
      tracking_id: firstOk?.tracking_id || null,
      prayog_awb: firstOk?.tracking_id || null,
      label_url: firstOk?.label_url || null,
      failure_reason: booked.length === 0
        ? `All ${boxes.length} boxes failed: ${results[0]?.error || "unknown error"}`.slice(0, 500)
        : null,
    }).eq("id", booking.id).select().single();

    // Best-effort admin notification.
    try {
      fetch(`${supabaseUrl}/functions/v1/send-order-admin-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ booking_id: booking.id }),
      }).catch(() => { /* ignore */ });
    } catch { /* ignore */ }

    return json({
      success: booked.length > 0,
      booking_id: booking.id,
      booking: updated || booking,
      total_amount: totalPrice,
      boxes: results,
      booked_count: booked.length,
      failed_count: results.length - booked.length,
    });
  } catch (err) {
    console.error("[business-create-shipment] error:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
