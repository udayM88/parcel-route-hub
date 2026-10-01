// Shree Maruti tracking through the Innofulfill gateway v2.
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { parseIstMs } from "../_shared/ist-time.ts";
import { normalizeCourierStatus } from "../_shared/courier-status.ts";
import { readGatewayError, shreeMarutiGatewayFetch } from "../_shared/shree-maruti-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const env = getEnvironmentFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const awb = String(body?.waybill || body?.awb || body?.cAwb || body?.c_awb || "").trim();
    if (!awb) return json({ error: "waybill is required" }, 400);

    const res = await shreeMarutiGatewayFetch(
      env,
      `/gateway/tracking-v2/api/tracking/awb/${encodeURIComponent(awb)}`,
      { method: "GET" },
      { retryTemporary: true },
    );
    const parsed = await readGatewayError(res);
    if (!res.ok) return json({ error: parsed.message, trace_id: parsed.traceId }, res.status);

    const inner = parsed.data?.data ?? parsed.data;
    const orderInfo = inner?.orderInformation || {};
    const rawStatuses = Array.isArray(inner?.statuses) ? inner.statuses : [];
    const statuses = rawStatuses.map((event: any) => {
      const rawStatus = event?.subcategory || event?.provider_status || event?.status || event?.category || "Update";
      const normalized = normalizeCourierStatus({
        status: event?.status || rawStatus,
        subcategory: rawStatus,
        category: event?.category,
        statusCode: event?.statusCode,
        remarks: event?.event,
      });
      const ts = event?.statusTimestamp || event?.createdAt || event?.timestamp;
      const tsMs = typeof ts === "number" ? ts : parseIstMs(ts);
      const when = Number.isFinite(tsMs) ? tsMs : Date.now();
      return {
        ...event,
        trackingId: String(orderInfo?.trackingId || awb),
        status: event?.status || rawStatus,
        provider_status: event?.provider_status || rawStatus,
        location: event?.location || "",
        deliveryPartnerName: orderInfo?.deliveryPartnerName || "Shree Maruti Courier",
        statusTimestamp: when,
        event: event?.event || rawStatus,
        category: normalized.normalized,
        subcategory: rawStatus,
        createdAt: new Date(when).toISOString(),
      };
    }).sort((a: any, b: any) => b.statusTimestamp - a.statusTimestamp);

    if (statuses.length === 0) {
      const rawStatus = orderInfo?.currentStatus || "ORDER_CREATED";
      const normalized = normalizeCourierStatus({ status: rawStatus });
      statuses.push({
        trackingId: awb, status: rawStatus, provider_status: rawStatus, location: "",
        deliveryPartnerName: orderInfo?.deliveryPartnerName || "Shree Maruti Courier",
        statusTimestamp: Date.now(), event: rawStatus,
        category: normalized.normalized, subcategory: rawStatus, createdAt: new Date().toISOString(),
      });
    }

    return json({
      orderInformation: { ...orderInfo, trackingId: orderInfo?.trackingId || awb },
      statuses,
      trace_id: inner?.trace_id || parsed.traceId,
    });
  } catch (err) {
    console.error("[shree-maruti-tracking] error", String(err));
    return json({ error: "Shree Maruti tracking request failed", details: String(err) }, 500);
  }
});