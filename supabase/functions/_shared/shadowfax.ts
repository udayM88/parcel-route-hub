// Shadowfax Marketplace 360 — Forward Logistics client.
// Docs: https://developer.shadowfax.in/docs/forward-logistics/quickstart
// One shared client so auth, base URL and environment isolation stay consistent.
import { getEnvironmentFromRequest, getShadowfaxConfig } from "./environment.ts";

export interface SfxResult { ok: boolean; status: number; data: any; raw: string }

export function sfxConfigFromRequest(req: Request) {
  const env = getEnvironmentFromRequest(req);
  const { apiBaseUrl, token } = getShadowfaxConfig(env);
  return { env, base: `${apiBaseUrl}/api`, token };
}

export async function sfxFetch(
  base: string, token: string, path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<SfxResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: init.method || (init.body ? "POST" : "GET"),
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
    });
    const raw = await res.text();
    let data: any; try { data = JSON.parse(raw); } catch { data = { raw }; }
    return { ok: res.ok, status: res.status, data, raw };
  } catch (e) {
    return { ok: false, status: 0, data: { error: String((e as Error)?.message || e) }, raw: "" };
  } finally { clearTimeout(t); }
}

/** Shadowfax rejects with HTTP 200 + message "Failure" — always read `message`. */
export function sfxAccepted(r: SfxResult): boolean {
  const m = String(r.data?.message || "").toLowerCase();
  return r.ok && (m === "success" || (!m && !r.data?.errors));
}

export function sfxError(r: SfxResult): string {
  const d = r.data || {};
  const errs = d.errors ? (typeof d.errors === "string" ? d.errors : JSON.stringify(d.errors)) : "";
  return String(errs || d.message || d.detail || d.error || `HTTP ${r.status}`).slice(0, 500);
}

/** Marketplace forward pincode check. Explicit "serviceable" listing only — never assumed. */
export async function sfxServiceablePins(base: string, token: string, pins: string[]) {
  const r = await sfxFetch(base, token,
    `/v1/clients/serviceability/?service=marketplace&pincodes=${pins.join(",")}&count=${pins.length}`);
  const list: any[] = Array.isArray(r.data) ? r.data
    : Array.isArray(r.data?.data) ? r.data.data
    : Array.isArray(r.data?.results) ? r.data.results : [];
  const ok = new Set<string>();
  for (const it of list) {
    const code = String(it?.code ?? it?.pincode ?? "");
    const services: string[] = Array.isArray(it?.services) ? it.services : [];
    if (code && services.length > 0) ok.add(code);
  }
  return { result: r, serviceable: ok, apiOk: r.ok && (Array.isArray(r.data) || Array.isArray(r.data?.data) || Array.isArray(r.data?.results)) };
}

// status_id → ViaSetu tracking buckets (Order Lifecycle doc).
const MAP: Record<string, { category: string; subcategory: string }> = {
  new: { category: "ORDER_CONFIRMED", subcategory: "Order Created" },
  assigned_for_pickup: { category: "ORDER_CONFIRMED", subcategory: "Rider Assigned" },
  assigned_for_seller_pickup: { category: "ORDER_CONFIRMED", subcategory: "Rider Assigned" },
  ofp: { category: "ORDER_CONFIRMED", subcategory: "Out For Pickup" },
  seller_initiated_delay: { category: "ORDER_CONFIRMED", subcategory: "Pickup Rescheduled" },
  seller_not_contactable: { category: "ORDER_CONFIRMED", subcategory: "Pickup Attempted" },
  pickup_not_attempted: { category: "ORDER_CONFIRMED", subcategory: "Pickup Not Attempted" },
  pickup_on_hold: { category: "ORDER_CONFIRMED", subcategory: "Pickup On Hold" },
  picked: { category: "IN_TRANSIT", subcategory: "Picked Up" },
  received_from_client_warehouse: { category: "IN_TRANSIT", subcategory: "Picked Up" },
  recd_at_rev_hub: { category: "IN_TRANSIT", subcategory: "Received at Hub" },
  recd_at_fwd_hub: { category: "IN_TRANSIT", subcategory: "In Transit" },
  recd_at_fwd_dc: { category: "IN_TRANSIT", subcategory: "Reached Destination Hub" },
  assigned_for_delivery: { category: "OUT_FOR_DELIVERY", subcategory: "Out for Delivery" },
  ofd: { category: "OUT_FOR_DELIVERY", subcategory: "Out for Delivery" },
  delivered: { category: "DELIVERED", subcategory: "Delivered" },
  cid: { category: "IN_TRANSIT", subcategory: "Delivery Rescheduled" },
  nc: { category: "IN_TRANSIT", subcategory: "Customer Not Contactable" },
  na: { category: "IN_TRANSIT", subcategory: "Delivery Not Attempted" },
  on_hold: { category: "IN_TRANSIT", subcategory: "On Hold" },
  reopen_ndr: { category: "IN_TRANSIT", subcategory: "Reattempt Scheduled" },
  rts: { category: "RTO", subcategory: "Return Initiated" },
  rto: { category: "RTO", subcategory: "Return Initiated" },
  rts_d: { category: "RTO", subcategory: "Returned to Sender" },
  rto_d: { category: "RTO", subcategory: "Returned to Sender" },
  lost: { category: "RTO", subcategory: "Shipment Lost" },
  qc_failed: { category: "RTO", subcategory: "Quality Check Failed" },
  cancelled: { category: "CANCELLED", subcategory: "Cancelled" },
  cancelled_by_customer: { category: "CANCELLED", subcategory: "Cancelled" },
};

export function mapSfxStatus(statusId?: string, label?: string) {
  const id = String(statusId || "").toLowerCase().trim();
  if (MAP[id]) return MAP[id];
  const l = String(label || id).toLowerCase();
  if (l.includes("cancel")) return MAP.cancelled;
  if (l.includes("deliver") && !l.includes("out for")) return MAP.delivered;
  if (l.includes("out for delivery")) return MAP.ofd;
  if (l.includes("return")) return MAP.rts;
  return { category: "IN_TRANSIT", subcategory: label || statusId || "In Transit" };
}
