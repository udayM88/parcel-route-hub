// Delhivery C2C Forward Order Booking — Orchestrator
// Per Delhivery B2C documentation, the C2C forward flow is:
//   1. (already done) Serviceability check
//   2. Create pickup location at SENDER's address  -> delhivery-warehouse-create
//   3. Fetch a waybill (AWB)                       -> delhivery-fetch-waybill
//   4. Create the shipment (cmu/create.json)       -> this function
//      - top-level shipment fields = RECEIVER (consignee / delivery destination)
//      - pickup_location.name      = warehouse name from step 2 (sender's address)
//      - waybill                   = AWB from step 3
//      - payment_mode              = "Prepaid"
//      - NO return_* keys (forward order, not RVP)
//   5. (on demand) Generate label                  -> delhivery-label
//   6. Schedule pickup at sender's address         -> delhivery-pickup-request
//   7. Track shipment                              -> delhivery-tracking

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getDelhiveryConfig, getEnvironmentFromRequest } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

interface BookingBody {
  order_id: string;
  // Sender = our customer (origin / pickup point)
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_pincode: string;
  sender_city: string;
  sender_state: string;
  // Receiver = consignee (destination)
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_pincode: string;
  receiver_city: string;
  receiver_state: string;
  package_weight: number; // kg
  goods_type?: string;
  shipment_value?: number;
  length?: number;
  width?: number;
  height?: number;
  service_code?: string; // delhivery_express | delhivery_surface
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const { apiBaseUrl, token } = getDelhiveryConfig(env);
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Delhivery token not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as BookingBody;
    const {
      order_id,
      sender_name, sender_phone, sender_address, sender_pincode, sender_city, sender_state,
      receiver_name, receiver_phone, receiver_address, receiver_pincode, receiver_city, receiver_state,
      package_weight, goods_type, shipment_value,
      length = 10, width = 10, height = 10,
      service_code = "delhivery_express",
    } = body;

    if (!order_id || !sender_name || !receiver_name || !sender_phone) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required fields: order_id, sender_name, sender_phone, receiver_name",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use Supabase client to invoke sibling edge functions
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const sharedHeaders = { "x-environment": env };

    // ───── Step 2: Create pickup location at sender's address ─────
    console.log("[delhivery-booking] step 2: warehouse-create");
    const whResp = await supabase.functions.invoke("delhivery-warehouse-create", {
      body: {
        sender_name, sender_phone, sender_address,
        sender_city, sender_state, sender_pincode,
      },
      headers: sharedHeaders,
    });
    if (whResp.error || !whResp.data?.success) {
      return new Response(JSON.stringify({
        success: false, step: "warehouse-create",
        error: whResp.data?.error || whResp.error?.message || "Failed to create pickup location",
        details: whResp.data,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const warehouseName: string = whResp.data.warehouse_name;
    console.log("[delhivery-booking] warehouse:", warehouseName, "reused:", whResp.data.reused);

    // ───── Step 3: Fetch waybill ─────
    console.log("[delhivery-booking] step 3: fetch-waybill");
    const wbResp = await supabase.functions.invoke("delhivery-fetch-waybill", {
      body: { count: 1 },
      headers: sharedHeaders,
    });
    if (wbResp.error || !wbResp.data?.success || !wbResp.data?.waybill) {
      return new Response(JSON.stringify({
        success: false, step: "fetch-waybill",
        error: wbResp.data?.error || wbResp.error?.message || "Failed to fetch waybill",
        details: wbResp.data,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const awb: string = wbResp.data.waybill;
    console.log("[delhivery-booking] awb:", awb);

    // ───── Step 4: Create shipment via cmu/create.json ─────
    const shipmentMode = service_code === "delhivery_surface" ? "Surface" : "Express";
    const weightG = Math.max(1, Math.round((package_weight || 0.1) * 1000));

    const shipmentPayload = {
      // Consignee (delivery destination = receiver)
      name: receiver_name,
      add: receiver_address,
      pin: receiver_pincode,
      city: receiver_city,
      state: receiver_state,
      country: "India",
      phone: receiver_phone,

      order: order_id,
      payment_mode: "Prepaid",
      products_desc: goods_type || "Package",
      hsn_code: "",
      cod_amount: "0",
      order_date: new Date().toISOString(),
      total_amount: String(shipment_value || 0),
      seller_name: "",
      seller_add: "",
      seller_inv: "",
      seller_gst_tin: "",
      quantity: "1",
      waybill: awb,
      shipment_width: String(width),
      shipment_height: String(height),
      shipment_length: String(length),
      weight: String(weightG),
      shipping_mode: shipmentMode,
      address_type: "home",
    };

    const fullPayload = {
      shipments: [shipmentPayload],
      pickup_location: { name: warehouseName },
    };

    const formBody = `format=json&data=${encodeURIComponent(JSON.stringify(fullPayload))}`;
    console.log("[delhivery-booking] step 4: cmu/create payload:", JSON.stringify(fullPayload));

    // Freshly created pickup locations can take a few seconds to propagate in
    // Delhivery's HQ. Retry the manifest when it reports the warehouse missing.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let cmuRes!: Response;
    let cmuText = "";
    let cmuResult: any = null;
    let pkg: any = null;
    let cmuOk = false;

    for (let attempt = 1; attempt <= 4; attempt++) {
      cmuRes = await fetch(`${apiBaseUrl}/api/cmu/create.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Token ${token}`,
          Accept: "application/json",
        },
        body: formBody,
      });
      cmuText = await cmuRes.text();
      try { cmuResult = JSON.parse(cmuText); } catch { cmuResult = { raw: cmuText }; }
      console.log(`[delhivery-booking] cmu response (attempt ${attempt}):`, cmuRes.status, cmuText.slice(0, 1200));

      pkg = Array.isArray(cmuResult?.packages) ? cmuResult.packages[0] : null;
      cmuOk = cmuRes.ok && (cmuResult?.success === true || pkg?.status === "Success");
      if (cmuOk) break;

      const warehouseMissing = /clientwarehouse matching query does not exist/i.test(
        `${cmuResult?.rmk || ""} ${pkg?.remarks?.join?.("; ") || ""} ${cmuText}`,
      );
      if (!warehouseMissing || attempt === 4) break;

      console.warn(`[delhivery-booking] warehouse ${warehouseName} not visible yet, retrying in ${attempt * 5}s`);
      await sleep(attempt * 5000);
    }

    if (!cmuOk) {
      const errMsg =
        pkg?.remarks?.join?.("; ") ||
        cmuResult?.rmk ||
        cmuResult?.error ||
        cmuResult?.message ||
        `Delhivery shipment create failed (${cmuRes.status})`;
      return new Response(JSON.stringify({
        success: false, step: "create-shipment",
        error: errMsg, delhivery_response: cmuResult,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const finalAwb = pkg?.waybill || awb;

    // ───── Step 6: Schedule pickup at sender's address ─────
    console.log("[delhivery-booking] step 6: pickup-request");
    const puResp = await supabase.functions.invoke("delhivery-pickup-request", {
      body: { pickup_location: warehouseName, expected_package_count: 1 },
      headers: sharedHeaders,
    });
    let pickupId: string | null = null;
    if (puResp.error || !puResp.data?.success) {
      // Non-fatal: shipment is already created with AWB. Log and continue.
      console.warn("[delhivery-booking] pickup-request failed (non-fatal):",
        puResp.data?.error || puResp.error?.message);
    } else {
      pickupId = puResp.data.pickup_id || null;
    }

    // Try to fetch label URL (non-fatal)
    let labelUrl: string | null = null;
    try {
      const lblResp = await supabase.functions.invoke("delhivery-label", {
        body: { waybill: finalAwb },
        headers: sharedHeaders,
      });
      if (lblResp.data?.success) labelUrl = lblResp.data.label_url || null;
    } catch (e) {
      console.warn("[delhivery-booking] label fetch failed (non-fatal):", e);
    }

    return new Response(JSON.stringify({
      success: true,
      orderId: order_id,
      awbNumber: finalAwb,
      pickup_id: pickupId,
      pickup_location: warehouseName,
      label_url: labelUrl,
      status: "CREATED",
      delhivery_response: cmuResult,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[delhivery-booking] error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
