// Shadowfax Marketplace 360 — forward tracking. GET /v4/clients/orders/{awb}/track/
// Returns statuses NEWEST FIRST (status refresh reads statuses[0] as latest).
import { mapSfxStatus, sfxConfigFromRequest, sfxError, sfxFetch } from "../_shared/shadowfax.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ts = (e: any) => {
  const v = e?.created || e?.created_at || e?.timestamp || e?.status_time || e?.date;
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { base, token } = sfxConfigFromRequest(req);
    if (!token) return json({ error: "Shadowfax API token not configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const awb = String(body.awb || body.waybill || body.client_request_id || "").trim();
    if (!awb) return json({ error: "awb is required" }, 400);

    const r = await sfxFetch(base, token, `/v4/clients/orders/${encodeURIComponent(awb)}/track/`);
    if (!r.ok) return json({ error: "Failed to fetch tracking", details: sfxError(r) }, r.status || 502);

    const od = r.data?.order_details || r.data?.data?.order_details || {};
    const events: any[] = r.data?.tracking_details || r.data?.data?.tracking_details || [];
    const sorted = [...events].sort((a, b) => ts(b) - ts(a));

    const statuses = sorted.map((e) => {
      const m = mapSfxStatus(e.status_id, e.status);
      const t = ts(e) || Date.now();
      return {
        trackingId: awb,
        status: e.status || e.status_id || m.subcategory,
        statusCode: e.status_id || null,
        location: e.location || e.current_location || e.hub_name || "",
        deliveryPartnerName: "Shadowfax",
        statusTimestamp: t,
        event: e.remarks || e.status || m.subcategory,
        remarks: e.remarks || null,
        category: m.category,
        subcategory: m.subcategory,
        createdAt: new Date(t).toISOString(),
      };
    });
    if (statuses.length === 0 && od.status) {
      const m = mapSfxStatus(od.status, od.status);
      statuses.push({
        trackingId: awb, status: od.status, statusCode: od.status, location: "", deliveryPartnerName: "Shadowfax",
        statusTimestamp: Date.now(), event: m.subcategory, remarks: null, category: m.category, subcategory: m.subcategory,
        createdAt: new Date().toISOString(),
      });
    }

    return json({
      orderInformation: {
        trackingId: awb,
        cAwbNumber: od.awb_number || awb,
        orderId: od.client_order_id || awb,
        sourceLocation: {}, destinationLocation: {},
        travelType: "surface",
        serviceType: "forward",
        bookingDate: od.order_date ? new Date(od.order_date).toISOString() : null,
        expectedDeliveryDate: od.promised_delivery_date || null,
        type: "FORWARD",
      },
      statuses,
    });
  } catch (err) {
    console.error("[shadowfax-tracking] error:", err);
    return json({ error: "Internal server error", details: String(err) }, 500);
  }
});
