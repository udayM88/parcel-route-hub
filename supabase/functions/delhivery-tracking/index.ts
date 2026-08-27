// Delhivery tracking via /api/v1/packages/json/?waybill=<AWB>
// Maps Delhivery scans to the app's TrackingData shape.

import { getDelhiveryConfig, getEnvironmentFromRequest } from "../_shared/environment.ts";
import { parseIstMs, toUtcIso } from "../_shared/ist-time.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

// Map common Delhivery status strings to app categories
function mapStatus(status: string, statusType?: string): { category: string; subcategory: string } {
  const s = (status || "").toLowerCase();
  const t = (statusType || "").toUpperCase();
  if (t === "DL" || s.includes("delivered")) return { category: "DELIVERED", subcategory: status || "Delivered" };
  if (s.includes("out for delivery")) return { category: "OUT_FOR_DELIVERY", subcategory: status };
  if (s.includes("picked")) return { category: "IN_TRANSIT", subcategory: status };
  if (s.includes("in transit") || s.includes("dispatched") || s.includes("bag")) {
    return { category: "IN_TRANSIT", subcategory: status };
  }
  if (s.includes("manifested") || s.includes("not picked") || s.includes("pending")) {
    return { category: "ORDER_CONFIRMED", subcategory: status };
  }
  if (s.includes("rto") || s.includes("returned")) return { category: "RTO", subcategory: status };
  if (s.includes("cancel")) return { category: "CANCELLED", subcategory: status };
  return { category: "IN_TRANSIT", subcategory: status || "In Transit" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const env = getEnvironmentFromRequest(req);
    const { apiBaseUrl, token } = getDelhiveryConfig(env);

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Delhivery token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { waybill, awb, order_id } = await req.json();
    const trackId = waybill || awb || order_id;
    if (!trackId) {
      return new Response(
        JSON.stringify({ error: "waybill is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `${apiBaseUrl}/api/v1/packages/json/?waybill=${encodeURIComponent(trackId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn("[delhivery-tracking] failed:", res.status, text.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to fetch tracking", details: text.slice(0, 500) }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = JSON.parse(text);
    const shipments: any[] = json?.ShipmentData || [];
    const ship = shipments[0]?.Shipment;
    if (!ship) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const scans: any[] = ship.Scans || [];
    const statuses = scans.map((entry: any) => {
      const sd = entry?.ScanDetail || entry || {};
      const ts = sd.ScanDateTime || sd.StatusDateTime || ship.PickedupDate || new Date().toISOString();
      const m = mapStatus(sd.Scan || sd.Instructions || sd.ScanType, sd.ScanType);
      return {
        trackingId: trackId,
        status: sd.Scan || sd.Instructions || "Update",
        location: sd.ScannedLocation || sd.City || "",
        deliveryPartnerName: "Delhivery",
        statusTimestamp: new Date(ts).getTime(),
        event: sd.Scan || sd.Instructions || "Update",
        category: m.category,
        subcategory: m.subcategory,
        createdAt: ts,
      };
    });

    if (statuses.length === 0) {
      const cur = ship.Status?.Status || ship.Status?.StatusType || "Manifested";
      const m = mapStatus(cur);
      statuses.push({
        trackingId: trackId,
        status: cur,
        location: "",
        deliveryPartnerName: "Delhivery",
        statusTimestamp: Date.now(),
        event: cur,
        category: m.category,
        subcategory: m.subcategory,
        createdAt: new Date().toISOString(),
      });
    }

    // Sort newest first
    statuses.sort((a, b) => b.statusTimestamp - a.statusTimestamp);

    // Forward order: Source = sender pickup location, Destination = consignee (receiver)
    const consignee = ship.Consignee || {};
    const trackingData = {
      orderInformation: {
        trackingId: trackId,
        cAwbNumber: ship.AWB || trackId,
        orderId: ship.ReferenceNo || trackId,
        sourceLocation: {
          address: ship.PickedUpFrom || ship.OriginCenter || "",
          city: ship.OriginCity || "",
          landmark: "",
          pincode: "",
          state: "",
        },
        destinationLocation: {
          address: consignee.Address1 || consignee.Address || "",
          city: consignee.City || "",
          landmark: "",
          pincode: String(consignee.PinCode || ""),
          state: consignee.State || "",
        },
        senderDetails: {
          sender_mobile: "",
          sender_name: ship.PickedUpFrom || "",
        },
        receiverDetails: {
          receiver_mobile: String(consignee.Telephone1 || consignee.Mobile || ""),
          receiver_name: consignee.Name || "",
        },
        travelType: ship.PickUpMode || "surface",
        serviceType: "standard",
        bookingDate: ship.PickUpDate || ship.OrderDate || new Date().toISOString(),
        type: "FORWARD",
      },
      statuses,
    };

    return new Response(JSON.stringify(trackingData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[delhivery-tracking] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
