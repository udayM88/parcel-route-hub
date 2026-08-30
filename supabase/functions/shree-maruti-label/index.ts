// Shree Maruti label fetch.
// GET /fulfillment/public/seller/order/download/label-invoice?awbNumber=...&cAwbNumber=...
// The endpoint returns a binary PDF (or sometimes a JSON envelope with a URL).
// We persist a base64 data URL on the booking row so the existing UI flow works
// (it just opens `label_url` in a new tab).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getEnvironmentFromRequest } from "../_shared/environment.ts";
import { shreeMarutiFetch } from "../_shared/shree-maruti-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // Deno provides btoa
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const env = getEnvironmentFromRequest(req);
    const { waybill, awb, cAwb, c_awb, booking_id, box_id } = await req.json().catch(() => ({}));
    const awbNumber = waybill || awb || null;
    const cAwbNumber = cAwb || c_awb || null;

    if (!awbNumber && !cAwbNumber) {
      return new Response(JSON.stringify({ success: false, error: "awb (waybill) or cAwb is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams();
    if (awbNumber) params.set("awbNumber", String(awbNumber));
    if (cAwbNumber) params.set("cAwbNumber", String(cAwbNumber));

    const path = `/fulfillment/public/seller/order/download/label-invoice?${params.toString()}`;
    console.log("[shree-maruti-label] requesting", path);

    const res = await shreeMarutiFetch(env, path, { method: "GET" });
    const contentType = res.headers.get("content-type") || "";
    console.log("[shree-maruti-label] response status", res.status, "content-type", contentType);

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[shree-maruti-label] failed", res.status, errText.slice(0, 800));
      return new Response(JSON.stringify({
        success: false,
        error: "Label fetch failed",
        status: res.status,
        details: errText.slice(0, 800),
      }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let labelUrl: string | null = null;

    if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      console.log("[shree-maruti-label] received binary PDF bytes:", buf.length);
      if (buf.length > 100) {
        const b64 = bytesToBase64(buf);
        labelUrl = `data:application/pdf;base64,${b64}`;
      } else {
        // Tiny payload — likely an error masquerading as binary
        const asText = new TextDecoder().decode(buf);
        console.warn("[shree-maruti-label] unexpectedly small binary payload:", asText.slice(0, 300));
      }
    } else {
      // JSON envelope (success or error) — log full body so we can adapt parsing.
      const text = await res.text();
      console.log("[shree-maruti-label] JSON body:", text.slice(0, 1500));
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      // Possible shapes documented / observed:
      //   { data: [{ shippingLabelUrl, invoiceUrl, awbNumber, ... }] }   <-- actual prod shape
      //   { data: { url|labelUrl|label_url|invoiceUrl|fileUrl: "..." } }
      //   { data: { base64|pdf|fileContent|label|invoice: "JVBERi0..." } }
      const innerRaw = data?.data ?? data;
      const inner = Array.isArray(innerRaw) ? (innerRaw[0] ?? {}) : innerRaw;
      labelUrl =
        inner?.shippingLabelUrl || inner?.shipping_label_url ||
        inner?.url || inner?.label_url || inner?.labelUrl ||
        inner?.invoiceUrl || inner?.invoice_url || inner?.fileUrl ||
        data?.url || data?.label_url || null;

      if (!labelUrl) {
        const b64 =
          inner?.base64 || inner?.pdf || inner?.fileContent ||
          inner?.label || inner?.invoice || data?.base64 || null;
        if (typeof b64 === "string" && b64.length > 100) {
          labelUrl = `data:application/pdf;base64,${b64.replace(/^data:[^,]+,/, "")}`;
        }
      }

      if (!labelUrl) {
        // Surface the partner-stated message back to the caller.
        const partnerMsg =
          data?.message || inner?.message || data?.error || inner?.error || null;
        return new Response(JSON.stringify({
          success: false,
          error: partnerMsg
            ? `Shree Maruti: ${partnerMsg}`
            : "Label not yet available from Shree Maruti",
          partner_response: text.slice(0, 800),
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!labelUrl) {
      return new Response(JSON.stringify({ success: false, error: "Label not yet available from Shree Maruti" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist on the parcel row (multi-parcel) or the booking row.
    if (box_id || booking_id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        if (box_id) {
          await supabase.from("booking_boxes").update({ label_url: labelUrl }).eq("id", box_id);
        } else {
          await supabase.from("bookings").update({ label_url: labelUrl }).eq("id", booking_id);
        }
      } catch (e) {
        console.warn("[shree-maruti-label] failed to persist label_url:", String(e));
      }
    }

    return new Response(JSON.stringify({ success: true, label_url: labelUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[shree-maruti-label] error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
