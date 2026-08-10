// Shree Maruti LIVE rate API (Innofulfill gateway, rate-calculation v2).
//
// Auth: the gateway uses its own login (username/password) that is separate
// from the Delcaper seller login used for booking/label/tracking.
// Credentials come from SHREE_MARUTI_INNO_USERNAME / SHREE_MARUTI_INNO_PASSWORD,
// falling back to the existing Shree Maruti prod email/password.
//
// If the API is unavailable (auth failure, downtime, unpriceable lane), callers
// must fall back to the embedded contracted rate card.

import { getShreeMarutiConfig, type Environment } from "./environment.ts";

const GATEWAY_BASE = "https://apis.innofulfill.com";
const RATE_V2_PATH = "/gateway/ure/api/external/rate-calculation/calculate/v2";
const LOGIN_PATH = "/auth/login";

interface CachedToken { token: string; expiresAt: number }
const tokenCache = new Map<Environment, CachedToken>();

// Auth option 1 (preferred when configured): static API key header.
function apiKeyHeaders(): Record<string, string> | null {
  const key = Deno.env.get("SHREE_MARUTI_INNO_API_KEY");
  if (!key) return null;
  return { "Api-Key": key };
}

// Auth option 2: Bearer id_token + TenantId header.
function tenantId(): string | undefined {
  return Deno.env.get("SHREE_MARUTI_INNO_TENANT_ID");
}

function gatewayCreds(env: Environment) {
  const fallback = getShreeMarutiConfig(env);
  const username =
    Deno.env.get("SHREE_MARUTI_INNO_USERNAME") || fallback.email;
  const password =
    Deno.env.get("SHREE_MARUTI_INNO_PASSWORD") || fallback.password;
  return { username, password };
}

async function getGatewayToken(env: Environment, force = false): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(env);
  if (!force && cached && cached.expiresAt - 300_000 > now) return cached.token;

  const { username, password } = gatewayCreds(env);
  if (!username || !password) {
    throw new Error("Shree Maruti gateway credentials not configured");
  }

  const res = await fetch(`${GATEWAY_BASE}${LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  const token: string | undefined =
    data?.data?.accessToken || data?.data?.access_token || data?.data?.token ||
    data?.accessToken || data?.access_token || data?.token;

  if (!res.ok || !token) {
    console.error("[sm-rate-api] gateway login failed", res.status, text.slice(0, 400));
    throw new Error(`Shree Maruti gateway auth failed: ${data?.message || res.status}`);
  }

  tokenCache.set(env, { token, expiresAt: now + 24 * 60 * 60 * 1000 });
  return token;
}

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
): Promise<{ amount: number; raw: unknown } | null> {
  const payload = {
    fromPincode: Number(params.pickup_pincode),
    toPincode: Number(params.delivery_pincode),
    weight: Math.round(Number(params.weight_kg) * 1000), // grams
    length: Number(params.length_cm),
    width: Number(params.width_cm),
    height: Number(params.height_cm),
    deliveryMode: params.mode,
    isCodOrder: false,
    codAmount: 0,
    declaredValue: params.declared_value ?? 1000,
  };

  const call = async (headers: Record<string, string>) =>
    fetch(`${GATEWAY_BASE}${RATE_V2_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
    });

  try {
    let res: Response;
    const keyHeaders = apiKeyHeaders();
    if (keyHeaders) {
      // Method 1: Api-Key
      res = await call(keyHeaders);
    } else {
      // Method 2: Bearer id_token (+ TenantId)
      const tid = tenantId();
      const bearer = (t: string) => ({
        Authorization: `Bearer ${t}`,
        ...(tid ? { TenantId: tid } : {}),
      });
      let token = await getGatewayToken(env);
      res = await call(bearer(token));
      if (res.status === 401 || res.status === 403) {
        tokenCache.delete(env);
        token = await getGatewayToken(env, true);
        res = await call(bearer(token));
      }
    }
    const text = await res.text();
    if (!res.ok) {
      console.warn("[sm-rate-api] rate v2 failed", res.status, text.slice(0, 300));
      return null;
    }
    let data: any;
    try { data = JSON.parse(text); } catch { return null; }

    // Response shape is tolerant: object, {data:{...}}, or {data:[{...}]}
    const node = data?.data ?? data;
    const candidates: any[] = Array.isArray(node) ? node : [node, ...(Array.isArray(node?.rates) ? node.rates : [])];
    for (const c of candidates) {
      const amount = pickAmount(c);
      if (amount != null) return { amount, raw: c };
    }
    console.warn("[sm-rate-api] no amount found in response", text.slice(0, 300));
    return null;
  } catch (e) {
    console.warn("[sm-rate-api] live rate error:", String(e));
    return null;
  }
}
