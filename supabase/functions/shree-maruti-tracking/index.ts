// Shree Maruti Ecom tracking.
// GET /fulfillment/public/seller/order/order-tracking/{awb}?awbNumber=...&cAwbNumber=...
// Returns a TrackingData shape compatible with our internal Tracking page.

import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { parseIstMs } from "../_shared/ist-time.ts";
import { shreeMarutiFetch } from "../_shared/shree-maruti-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

// Per docs ORDER STATUS table.
function mapStatus(raw: string): { category: string; subcategory: string } {
  const s = (raw || "").toUpperCase().trim();
  const sub = raw || "Update";
  switch (s) {
    case "DELIVERED": return { category: "DELIVERED", subcategory: sub };
    case "OUT_FOR_DELIVERY": return { category: "OUT_FOR_DELIVERY", subcategory: sub };
    case "PICKED_UP": return { category: "IN_TRANSIT", subcategory: sub };
    case "OUT_FOR_PICKUP":
    case "NOT_PICKED_UP": return { category: "ORDER_CONFIRMED", subcategory: sub };
    case "IN_TRANSIT": return { category: "IN_TRANSIT", subcategory: sub };
    case "READY_FOR_DISPATCH":
    case "IN_PROCESS":
    case "NEW": return { category: "ORDER_CONFIRMED", subcategory: sub };
    case "ON_HOLD": return { category: "IN_TRANSIT", subcategory: sub };
    case "CANCELED":
    case "CANCELLED": return { category: "CANCELLED", subcategory: sub };
  }
  const v = s.toLowerCase();
  if (v.includes("delivered")) return { category: "DELIVERED", subcategory: sub };
  if (v.includes("out for delivery")) return { category: "OUT_FOR_DELIVERY", subcategory: sub };
  if (v.includes("picked")) return { category: "IN_TRANSIT", subcategory: sub };
  if (v.includes("transit")) return { category: "IN_TRANSIT", subcategory: sub };
  if (v.includes("rto") || v.includes("return")) return { category: "RTO", subcategory: sub };
  if (v.includes("cancel")) return { category: "CANCELLED", subcategory: sub };
  return { category: "ORDER_CONFIRMED", subcategory: sub };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const { waybill, awb, cAwb, c_awb, order_id } = await req.json().catch(() => ({}));
    const trackId = waybill || awb || cAwb || c_awb || order_id;
    if (!trackId) {
      return new Response(JSON.stringify({ error: "waybill is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per docs: GET /fulfillment/public/seller/order/order-tracking/{id}
    // Path-style id; query params also accepted as fallback.
    const path = `/fulfillment/public/seller/order/order-tracking/${encodeURIComponent(String(trackId))}`;
    const res = await shreeMarutiFetch(env, path, { method: "GET" });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      console.warn("[shree-maruti-tracking] failed", res.status, text.slice(0, 500));
      return new Response(JSON.stringify({
        error: "Failed to fetch tracking",
        details: text.slice(0, 500),
      }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const inner = data?.data ?? data;
    const events: any[] =
      Array.isArray(inner?.events) ? inner.events :
      Array.isArray(inner?.history) ? inner.history :
      Array.isArray(inner?.statusHistory) ? inner.statusHistory :
      Array.isArray(inner?.trackingHistory) ? inner.trackingHistory :
      Array.isArray(inner?.scans) ? inner.scans :
      Array.isArray(inner) ? inner : [];

    const headInfo = (Array.isArray(inner) ? {} : inner) || {};
    const currentStatus =
      headInfo?.currentStatus || headInfo?.status || headInfo?.orderStatus || "";

    const statuses = events.map((e: any) => {
      const ts = e?.createdAt || e?.timestamp || e?.eventDate || e?.date || e?.scanDateTime || new Date().toISOString();
      const statusRaw = e?.status || e?.eventStatus || e?.scanType || e?.activity || "Update";
      const m = mapStatus(statusRaw);
      const tsMs = parseIstMs(ts);
      return {
        trackingId: String(trackId),
        status: statusRaw,
        location: e?.location || e?.city || e?.hub || e?.scanLocation || "",
        deliveryPartnerName: "Shree Maruti Courier",
        statusTimestamp: isNaN(tsMs) ? Date.now() : tsMs,
        event: e?.remarks || e?.statusDescription || statusRaw,
        category: m.category,
        subcategory: m.subcategory,
        createdAt: new Date(isNaN(tsMs) ? Date.now() : tsMs).toISOString(),
      };
    });

    if (statuses.length === 0) {
      const m = mapStatus(currentStatus || "NEW");
      statuses.push({
        trackingId: String(trackId),
        status: currentStatus || "Booked",
        location: "",
        deliveryPartnerName: "Shree Maruti Courier",
        statusTimestamp: Date.now(),
        event: currentStatus || "Booked",
        category: m.category,
        subcategory: m.subcategory,
        createdAt: new Date().toISOString(),
      });
    }
    statuses.sort((a, b) => b.statusTimestamp - a.statusTimestamp);

    const trackingData = {
      orderInformation: {
        trackingId: String(trackId),
        cAwbNumber: headInfo?.cAwbNumber || headInfo?.cawbNumber || String(trackId),
        orderId: headInfo?.orderId || headInfo?.orderID || String(trackId),
        sourceLocation: { address: "", city: "", landmark: "", pincode: "", state: "" },
        destinationLocation: { address: "", city: "", landmark: "", pincode: "", state: "" },
        senderDetails: { sender_mobile: "", sender_name: "" },
        receiverDetails: { receiver_mobile: "", receiver_name: "" },
        travelType: headInfo?.deliveryMode || "surface",
        serviceType: headInfo?.deliveryMode || "standard",
        bookingDate: headInfo?.createdAt || new Date().toISOString(),
        type: "FORWARD",
        edd: headInfo?.expectedDeliveryDate || headInfo?.edd || "",
        podUrl: headInfo?.podUrl || "",
        weight: headInfo?.weight || "",
        pieces: headInfo?.pieces || 1,
      },
      statuses,
    };

    return new Response(JSON.stringify(trackingData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[shree-maruti-tracking] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
