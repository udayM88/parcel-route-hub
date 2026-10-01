// Shree Maruti ECOMM booking through the documented Innofulfill gateway v2.
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import {
  readGatewayError,
  SHREE_MARUTI_CARRIER_ID,
  SHREE_MARUTI_CARRIER_NAME,
  shreeMarutiGatewayFetch,
} from "../_shared/shree-maruti-gateway.ts";
import { isPartnerEnabled } from "../_shared/partner-toggle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment, x-internal-key, x-prayog-auth",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function cleanPhone(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function validBody(body: any): string | null {
  for (const field of ["order_id", "sender_name", "sender_phone", "sender_address", "sender_pincode", "sender_city", "sender_state", "receiver_name", "receiver_phone", "receiver_address", "receiver_pincode", "receiver_city", "receiver_state"]) {
    if (!String(body?.[field] || "").trim()) return `Missing required field: ${field}`;
  }
  if (!/^\d{6}$/.test(String(body.sender_pincode)) || !/^\d{6}$/.test(String(body.receiver_pincode))) return "Pincodes must be 6 digits";
  if (!/^\d{10}$/.test(cleanPhone(body.sender_phone)) || !/^\d{10}$/.test(cleanPhone(body.receiver_phone))) return "Phone numbers must be 10 digits";
  if (!(Number(body.package_weight) > 0)) return "package_weight must be a positive number in kg";
  for (const field of ["length", "width", "height"]) {
    if (body[field] != null && !(Number(body[field]) > 0)) return `${field} must be positive`;
  }
  return null;
}

function address(type: string, body: any, sender: boolean) {
  const prefix = sender ? "sender" : "receiver";
  const addressText = String(body[`${prefix}_address`] || "");
  return {
    type,
    zip: Number(body[`${prefix}_pincode`]),
    name: String(body[`${prefix}_name`]),
    phone: cleanPhone(body[`${prefix}_phone`]),
    email: "",
    street: addressText,
    landmark: "",
    city: String(body[`${prefix}_city`]),
    state: String(body[`${prefix}_state`]),
    country: "India",
    addressName: addressText,
    ...(type === "PICKUP" ? { GSTNumber: "" } : {}),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const internal = req.headers.get("x-internal-key") || "";
    const prayogAuth = req.headers.get("x-prayog-auth");
    if (!(serviceKey && (bearer === serviceKey || internal === serviceKey)) && !prayogAuth) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    if (!(await isPartnerEnabled("shree_maruti"))) {
      return json({ success: false, error: "Shree Maruti is currently disabled" }, 503);
    }

    const env = getEnvironmentFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const validationError = validBody(body);
    if (validationError) return json({ success: false, error: validationError }, 400);

    const referenceId = String(body.order_id);
    const weightKg = Number(body.package_weight);
    const declaredValue = Math.max(1, Number(body.shipment_value) || 100);
    const length = Number(body.length) || 10;
    const width = Number(body.width) || 10;
    const height = Number(body.height) || 10;
    const mode = String(body.service_code || "").toLowerCase().includes("express") ? "AIR" : "SURFACE";
    const volumetricWeight = Math.round(((length * width * height) / 5000) * 1000) / 1000;

    const payload = {
      referenceId,
      orderDate: new Date().toISOString(),
      orderType: "FORWARD",
      orderStatus: "CONFIRMED",
      parcelCategory: "ECOMM",
      autoManifest: true,
      eWaybills: [],
      deliveryPromise: "ECOMM",
      deliveryMode: mode,
      documentType: "",
      taxes: [],
      discounts: [],
      metadata: { source: "viasetu" },
      documents: [],
      addresses: [
        address("PICKUP", body, true),
        address("DELIVERY", body, false),
        address("BILLING", body, false),
        address("RETURN", body, true),
      ],
      shipments: [{
        dimensions: { length, width, height },
        shipmentStatus: "CONFIRMED",
        awbNumber: "",
        physicalWeight: weightKg,
        physicalWeightUnit: "KG",
        volumetricWeight,
        note: "Booked via ViaSetu",
        items: [{
          name: String(body.goods_type || "Package"),
          quantity: 1,
          unitPrice: declaredValue,
          sku: referenceId,
          hsnCode: "",
          description: String(body.goods_type || "Package"),
        }],
      }],
      carrierId: SHREE_MARUTI_CARRIER_ID,
      carrierName: SHREE_MARUTI_CARRIER_NAME,
      payment: { type: "PREPAID", currency: "INR", paymentMethod: "ONLINE" },
    };

    console.log(`[shree-maruti-booking] creating reference=${referenceId} mode=${mode} weight_kg=${weightKg}`);
    // No automatic 5xx retry here: repeating order creation could duplicate an accepted order.
    const res = await shreeMarutiGatewayFetch(env, "/gateway/booking-service/orders", {
      method: "POST", body: JSON.stringify(payload),
    });
    const parsed = await readGatewayError(res);
    const inner = parsed.data?.data ?? parsed.data;
    const partnerOrderId = inner?.orderId || null;
    const shipment = Array.isArray(inner?.shipments) ? inner.shipments[0] : null;
    const awb = shipment?.awbNumber || null;

    if (!res.ok || !partnerOrderId || !awb) {
      console.warn(`[shree-maruti-booking] failed status=${res.status} reference=${referenceId} trace=${parsed.traceId || "none"}`);
      return json({
        success: false,
        error: parsed.message,
        status: res.status,
        trace_id: parsed.traceId,
        partner_response: parsed.data,
      }, res.status >= 400 ? res.status : 502);
    }

    return json({
      success: true,
      orderId: String(partnerOrderId),
      referenceId,
      awbNumber: String(awb),
      awb: String(awb),
      label_url: null,
      status: inner?.orderStatus || shipment?.shipmentStatus || "PROCESSING",
      trace_id: parsed.traceId,
    }, 201);
  } catch (err) {
    console.error("[shree-maruti-booking] error", String(err));
    return json({ success: false, error: "Shree Maruti booking request failed", details: String(err) }, 500);
  }
});