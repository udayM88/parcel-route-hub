// Urbanebolt tracking — GET /api/v1/services/tracking-pub/?awb=<AWB>
// Maps to the same TrackingData shape used by Shadowfax/Delhivery.

import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { parseIstMs } from "../_shared/ist-time.ts";
import { urbaneboltFetch } from "../_shared/urbanebolt-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

// Map Urbanebolt status_code (primary) and fall back to description text.
// Codes: PKD/OFP picked, INT in-transit, OFD out-for-delivery, DDL delivered,
// RTO return, CNL cancel, MNF/BKD manifested.
function mapStatus(code: string, desc: string): { category: string; subcategory: string } {
  const c = (code || "").toUpperCase().trim();
  const sub = desc || code || "Update";
  switch (c) {
    case "DDL": return { category: "DELIVERED", subcategory: sub };
    case "OFD": return { category: "OUT_FOR_DELIVERY", subcategory: sub };
    case "PKD":
    case "OFP":
    case "INT":
    case "RAD": return { category: "IN_TRANSIT", subcategory: sub };
    case "RTO":
    case "RTD": return { category: "RTO", subcategory: sub };
    case "CNL":
    case "CAN": return { category: "CANCELLED", subcategory: sub };
    case "MNF":
    case "BKD": return { category: "ORDER_CONFIRMED", subcategory: sub };
  }
  const v = (desc || "").toLowerCase();
  if (v.includes("delivered")) return { category: "DELIVERED", subcategory: sub };
  if (v.includes("out for delivery")) return { category: "OUT_FOR_DELIVERY", subcategory: sub };
  if (v.includes("picked")) return { category: "IN_TRANSIT", subcategory: sub };
  if (v.includes("transit") || v.includes("dispatched") || v.includes("hub")) return { category: "IN_TRANSIT", subcategory: sub };
  if (v.includes("manifest") || v.includes("booked") || v.includes("created")) return { category: "ORDER_CONFIRMED", subcategory: sub };
  if (v.includes("rto") || v.includes("return")) return { category: "RTO", subcategory: sub };
  if (v.includes("cancel")) return { category: "CANCELLED", subcategory: sub };
  return { category: "IN_TRANSIT", subcategory: sub };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const { waybill, awb, order_id } = await req.json().catch(() => ({}));
    const trackId = waybill || awb || order_id;
    if (!trackId) {
      return new Response(JSON.stringify({ error: "waybill is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await urbaneboltFetch(env, `/api/v1/services/tracking-pub/?awb=${encodeURIComponent(trackId)}`, {
      method: "GET",
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn("[urbanebolt-tracking] failed", res.status, text.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to fetch tracking", details: text.slice(0, 500) }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Urbanebolt commonly returns a flat array of events (per provided sample) or { data: [...] }.
    const events: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data?.events) ? data.events
      : Array.isArray(data?.history) ? data.history
      : [];

    // Pull header info from the most recent event.
    const head = events[0] || data?.data || data || {};
    const podUrl = events.find((e) => e?.pod_url)?.pod_url || "";
    const edd = head?.edd || "";
    const orderNo = head?.order_number || head?.order_no || trackId;

    const statuses = events.map((entry: any) => {
      const ts = entry?.event_date || entry?.timestamp || entry?.scan_time || new Date().toISOString();
      const code = entry?.status_code || "";
      const desc = entry?.status_description || entry?.status || entry?.event || entry?.remarks || "Update";
      const m = mapStatus(code, desc);
      // event_date is "YYYY-MM-DD HH:mm:ss" (no TZ) — treat as IST.
      const tsMs = typeof ts === "string"
        ? Date.parse(ts.replace(" ", "T") + (ts.includes("T") ? "" : "+05:30"))
        : new Date(ts).getTime();
      return {
        trackingId: trackId,
        status: desc,
        location: entry?.event_location || entry?.location || entry?.city || entry?.hub || "",
        deliveryPartnerName: "Urbanebolt",
        statusTimestamp: isNaN(tsMs) ? Date.now() : tsMs,
        event: desc,
        category: m.category,
        subcategory: m.subcategory,
        createdAt: new Date(isNaN(tsMs) ? Date.now() : tsMs).toISOString(),
        statusCode: code,
        reasonCode: entry?.reason_code || "",
        podUrl: entry?.pod_url || "",
        otpVerified: entry?.otp_verified || "",
      };
    });

    if (statuses.length === 0) {
      const cur = head?.status_description || head?.status || "Manifested";
      const m = mapStatus(head?.status_code || "", cur);
      statuses.push({
        trackingId: trackId,
        status: cur,
        location: "",
        deliveryPartnerName: "Urbanebolt",
        statusTimestamp: Date.now(),
        event: cur,
        category: m.category,
        subcategory: m.subcategory,
        createdAt: new Date().toISOString(),
        statusCode: head?.status_code || "",
        reasonCode: "",
        podUrl: "",
        otpVerified: "",
      });
    }
    statuses.sort((a, b) => b.statusTimestamp - a.statusTimestamp);

    const trackingData = {
      orderInformation: {
        trackingId: trackId,
        cAwbNumber: head?.awb || trackId,
        orderId: orderNo,
        sourceLocation: { address: "", city: "", landmark: "", pincode: "", state: "" },
        destinationLocation: { address: "", city: "", landmark: "", pincode: "", state: "" },
        senderDetails: { sender_mobile: "", sender_name: "" },
        receiverDetails: { receiver_mobile: "", receiver_name: "" },
        travelType: head?.product_type || "surface",
        serviceType: head?.product_type || "standard",
        bookingDate: head?.event_date || new Date().toISOString(),
        type: head?.isReturn ? "REVERSE" : "FORWARD",
        edd,
        podUrl,
        weight: head?.weight || "",
        pieces: head?.pieces || 1,
      },
      statuses,
    };

    return new Response(JSON.stringify(trackingData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[urbanebolt-tracking] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
