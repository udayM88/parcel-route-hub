// Shree Maruti LIVE rate API (Innofulfill gateway, rate-calculation v2).
//
// Auth: the gateway uses its own login (username/password) that is separate
// from the Delcaper seller login used for booking/label/tracking.
// Credentials come from SHREE_MARUTI_INNO_USERNAME / SHREE_MARUTI_INNO_PASSWORD,
// falling back to the existing Shree Maruti prod email/password.
//
// If the API is unavailable (auth failure, downtime, unpriceable lane), callers
// must fall back to the embedded contracted rate card.

import type { Environment } from "./environment.ts";
import { shreeMarutiGatewayFetch } from "./shree-maruti-gateway.ts";

const RATE_V2_PATH = "/gateway/ure/api/external/rate-calculation/calculate/v2";

function pickAmount(obj: any): number | null {
  if (obj == null) return null;
  if (typeof obj === "number") return Number.isFinite(obj) && obj > 0 ? obj : null;
  const keys = [
    "totalAmount", "total_amount", "totalCharge", "totalCharges",
    "grandTotal", "finalAmount", "shippingCharge", "shipping_charge",
    "totalFreight", "freightCharge", "amount", "price", "rate",
  ];
  for (const k of keys) {
    const v = obj?.[k];
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Fetches a live rate for one mode. Returns null when the API can't price it.
 */
export async function fetchShreeMarutiLiveRate(
  env: Environment,
  params: {
    pickup_pincode: string | number;
    delivery_pincode: string | number;
    weight_kg: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
    mode: "SURFACE" | "AIR";
    declared_value?: number;
  },
): Promise<{ amount: number; gstAmount: number | null; totalAmount: number | null; traceId: string | null; raw: unknown } | null> {
  const payload = {
    fromPincode: Number(params.pickup_pincode),
    toPincode: Number(params.delivery_pincode),
    serviceType: "ECOMM",
    productType: "ECOMM",
    weight: Number(params.weight_kg), // KG per docs
    length: Number(params.length_cm),
    height: Number(params.height_cm),
    width: Number(params.width_cm),
    includeDefaultCharges: false,
    userOptions: {
      insurance: { enabled: false, amount: params.declared_value ?? 0 },
      cod: false,
    },
    filters: { delivery_mode: params.mode },
  };

  try {
    const res = await shreeMarutiGatewayFetch(
      env,
      RATE_V2_PATH,
      { method: "POST", body: JSON.stringify(payload) },
      { retryTemporary: true },
    );
    const text = await res.text();
    if (!res.ok) {
      console.warn("[sm-rate-api] rate v2 failed", res.status, text.slice(0, 300));
      return null;
    }
    let data: any;
    try { data = JSON.parse(text); } catch { return null; }

    // Documented shape: data.pricing.baseRate (pre-GST) + data.calculation.totalAmount (incl GST).
    // We quote pre-GST because GST is applied downstream by ViaSetu pricing.
    const d = data?.data ?? data;
    const baseRate = pickAmount({ amount: d?.pricing?.baseRate }) ??
      pickAmount({ amount: d?.calculation?.baseAmount });
    if (baseRate != null) return {
      amount: baseRate,
      gstAmount: Number.isFinite(Number(d?.taxSummary?.totalTax)) ? Number(d.taxSummary.totalTax) : null,
      totalAmount: Number.isFinite(Number(d?.calculation?.totalAmount)) ? Number(d.calculation.totalAmount) : null,
      traceId: data?.trace_id || data?.traceId || null,
      raw: d,
    };

    // Fallback: tolerant scan (object, {data:{...}}, or {data:[{...}]})
    const node = d;
    const candidates: any[] = Array.isArray(node) ? node : [node, ...(Array.isArray(node?.rates) ? node.rates : [])];
    for (const c of candidates) {
      const amount = pickAmount(c);
      if (amount != null) return { amount, gstAmount: null, totalAmount: null, traceId: data?.trace_id || data?.traceId || null, raw: c };
    }
    console.warn("[sm-rate-api] no amount found in response", text.slice(0, 300));
    return null;
  } catch (e) {
    console.warn("[sm-rate-api] live rate error:", String(e));
    return null;
  }
}
