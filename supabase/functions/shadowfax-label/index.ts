// Shadowfax Reverse Pickup — Label generator (in-house)
// Shadowfax does NOT expose a shipping-label endpoint, so we build a printable
// HTML label from the booking row. Returns a data: URL that the frontend can
// open in a new tab and Save as PDF / print.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

function escape(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLabelHtml(b: any): string {
  const awb = b.prayog_awb || b.tracking_id || "—";
  const orderId = b.prayog_order_id || b.id;
  const created = b.created_at ? new Date(b.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";
  const weight = b.package_weight ? `${b.package_weight} kg` : "—";
  const dims = (b.length && b.width && b.height) ? `${b.length} × ${b.width} × ${b.height} cm` : "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Shipping Label — ${escape(awb)}</title>
<style>
  @page { size: A5; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000; margin: 0; padding: 12px; background: #fff; }
  .label { border: 2px solid #000; padding: 12px; max-width: 560px; margin: 0 auto; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
  .badge { font-size: 11px; font-weight: 700; padding: 4px 8px; border: 1.5px solid #000; border-radius: 4px; }
  .reverse-banner { background: #000; color: #fff; text-align: center; font-weight: 800; letter-spacing: 2px; padding: 6px; margin: 8px 0; font-size: 13px; }
  .awb-block { text-align: center; border: 2px solid #000; padding: 8px; margin: 8px 0; }
  .awb-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; }
  .awb-num { font-size: 26px; font-weight: 800; font-family: "Courier New", monospace; letter-spacing: 2px; margin-top: 2px; }
  .barcode { display: flex; justify-content: center; gap: 1px; margin-top: 6px; height: 36px; align-items: stretch; }
  .barcode span { display: block; background: #000; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .box { border: 1.5px solid #000; padding: 8px; min-height: 110px; }
  .box-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; }
  .name { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
  .addr { font-size: 11px; line-height: 1.35; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; font-size: 11px; }
  .meta div { border: 1px solid #000; padding: 4px 6px; }
  .meta b { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1px; }
  .footer { margin-top: 8px; font-size: 9px; text-align: center; color: #333; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
  .no-print { text-align: center; margin: 12px 0; }
  .no-print button { padding: 8px 16px; font-size: 14px; cursor: pointer; }
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="label">
    <div class="row">
      <div class="brand">ViaSetu</div>
      <div class="badge">Shadowfax · Reverse Pickup</div>
    </div>

    <div class="reverse-banner">REVERSE PICKUP — CUSTOMER → SELLER</div>

    <div class="awb-block">
      <div class="awb-label">AWB / Tracking Number</div>
      <div class="awb-num">${escape(awb)}</div>
      <div class="barcode" id="barcode"></div>
    </div>

    <div class="grid">
      <div class="box">
        <div class="box-title">Pickup From (Customer)</div>
        <div class="name">${escape(b.sender_name)}</div>
        <div class="addr">${escape(b.sender_address)}<br/>${escape(b.sender_city)}, ${escape(b.sender_state)} - <b>${escape(b.sender_pincode)}</b><br/>📞 ${escape(b.sender_phone)}</div>
      </div>
      <div class="box">
        <div class="box-title">Deliver To (Seller)</div>
        <div class="name">${escape(b.receiver_name)}</div>
        <div class="addr">${escape(b.receiver_address)}<br/>${escape(b.receiver_city)}, ${escape(b.receiver_state)} - <b>${escape(b.receiver_pincode)}</b><br/>📞 ${escape(b.receiver_phone)}</div>
      </div>
    </div>

    <div class="meta">
      <div><b>Order ID</b>${escape(orderId)}</div>
      <div><b>Weight</b>${escape(weight)}</div>
      <div><b>Dimensions</b>${escape(dims)}</div>
      <div><b>Contents</b>${escape(b.goods_type || "Package")}</div>
      <div><b>Booked</b>${escape(created)}</div>
      <div><b>Service</b>Surface · RVP</div>
    </div>

    <div class="footer">Generated by ViaSetu • Handle with care • For pickup queries contact ViaSetu support</div>
  </div>
  <script>
    // Simple visual barcode from AWB characters (not scannable; for visual reference only)
    (function() {
      var awb = ${JSON.stringify(awb)};
      var bc = document.getElementById('barcode');
      if (!bc) return;
      for (var i = 0; i < awb.length; i++) {
        var code = awb.charCodeAt(i);
        for (var j = 0; j < 4; j++) {
          var bit = (code >> j) & 1;
          var s = document.createElement('span');
          s.style.width = bit ? '3px' : '1px';
          bc.appendChild(s);
        }
      }
    })();
  </script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id, awb, waybill, box_id } = await req.json().catch(() => ({}));
    if (!booking_id && !awb && !waybill) {
      return new Response(
        JSON.stringify({ success: false, error: "booking_id or awb is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase.from("bookings").select("*");
    if (booking_id) {
      query = query.eq("id", booking_id);
    } else {
      const id = awb || waybill;
      query = query.or(`prayog_awb.eq.${id},tracking_id.eq.${id}`);
    }
    const { data: b, error } = await query.maybeSingle();

    if (error || !b) {
      return new Response(
        JSON.stringify({ success: false, error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Multi-parcel orders: print THIS parcel's weight/dimensions/AWB, not
    // the order rollup — otherwise every parcel prints the same label.
    let labelRow: any = b;
    if (box_id) {
      const { data: box } = await supabase
        .from("booking_boxes").select("*").eq("id", box_id).maybeSingle();
      if (box) {
        labelRow = {
          ...b,
          package_weight: box.weight_kg != null ? String(box.weight_kg) : b.package_weight,
          length: box.length_cm != null ? String(box.length_cm) : b.length,
          width: box.width_cm != null ? String(box.width_cm) : b.width,
          height: box.height_cm != null ? String(box.height_cm) : b.height,
          prayog_awb: box.tracking_id || b.prayog_awb,
          tracking_id: box.tracking_id || b.tracking_id,
          box_index: box.box_index,
          box_count: b.box_count,
        };
      }
    }

    const html = buildLabelHtml(labelRow);
    // Encode as a data: URL so the frontend can window.open() it directly.
    const dataUrl = "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(html)));

    return new Response(
      JSON.stringify({ success: true, label_url: dataUrl, format: "html" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[shadowfax-label] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
