// Sends an admin notification email when a new booking is successfully placed.
// Sends over the project's SMTP configuration. Idempotent: only sends if
// bookings.admin_email_sent_at IS NULL, then stamps it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-prayog-auth, x-environment",
};

const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USERNAME") || Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASSWORD") || Deno.env.get("SMTP_PASS");

function inr(n: any) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function row(label: string, value: any) {
  if (value === null || value === undefined || value === "") return "";
  return `<tr><td style="padding:6px 12px;color:#555;border-bottom:1px solid #eee;">${label}</td><td style="padding:6px 12px;font-weight:600;border-bottom:1px solid #eee;">${value}</td></tr>`;
}

function buildHtml(b: any) {
  const total =
    Number(b.base_fare || 0) +
    Number(b.platform_fee || 0) +
    Number(b.gst || 0) +
    Number(b.insurance_amount || 0) +
    Number(b.packaging_amount || 0);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7f9;padding:20px;color:#111;">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#06b6d4;color:#000;padding:16px 20px;">
      <h2 style="margin:0;">🚚 New Order Placed</h2>
      <div style="font-size:13px;opacity:.85;">ViaSetu Admin Notification</div>
    </div>
    <div style="padding:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("Order ID", b.id)}
        ${row("AWB / Tracking", b.prayog_awb || b.tracking_id || "—")}
        ${row("Courier", b.courier_name)}
        ${row("Status", b.status)}
        ${row("Payment ID", b.payment_id)}
        ${row("Payment Status", b.payment_status)}
        ${row("Amount Paid", inr(total))}
        ${row("Booking Time", new Date(b.created_at || Date.now()).toLocaleString("en-IN"))}
      </table>

      <h3 style="margin:18px 0 6px;font-size:15px;">Sender</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("Name", b.sender_name)}
        ${row("Phone", b.sender_phone)}
        ${row("Address", `${b.sender_address || ""}, ${b.sender_city || ""}, ${b.sender_state || ""} - ${b.sender_pincode || ""}`)}
      </table>

      <h3 style="margin:18px 0 6px;font-size:15px;">Receiver</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("Name", b.receiver_name)}
        ${row("Phone", b.receiver_phone)}
        ${row("Address", `${b.receiver_address || ""}, ${b.receiver_city || ""}, ${b.receiver_state || ""} - ${b.receiver_pincode || ""}`)}
      </table>

      <h3 style="margin:18px 0 6px;font-size:15px;">Shipment</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("Goods Type", b.goods_type)}
        ${row("Weight", `${b.package_weight} kg`)}
        ${row("Dimensions (LxWxH)", b.length ? `${b.length} × ${b.width} × ${b.height} cm` : "—")}
        ${row("Declared Value", inr(b.shipment_value))}
        ${row("Urgency", b.urgency)}
        ${row("Delivery ETA", b.delivery_time)}
      </table>

      <h3 style="margin:18px 0 6px;font-size:15px;">Price Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("Base Fare", inr(b.base_fare))}
        ${row("GST (18%)", inr(b.gst))}
        ${b.insurance_amount ? row("Insurance", inr(b.insurance_amount)) : ""}
        ${b.packaging_amount ? row("Packaging", inr(b.packaging_amount)) : ""}
        <tr><td style="padding:8px 12px;font-weight:700;">Total</td><td style="padding:8px 12px;font-weight:700;">${inr(total)}</td></tr>
      </table>
    </div>
    <div style="padding:12px 20px;background:#f3f4f6;font-size:12px;color:#666;">This is an automated notification from ViaSetu.</div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return new Response(JSON.stringify({ error: "SMTP is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { booking_id, force } = body || {};
    const overrideRecipient = req.headers.get("x-override-recipient") || body?.override_recipient || null;
    if (!booking_id) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load config
    const { data: cfgRow } = await supabase
      .from("system_settings").select("value").eq("key", "email_config").maybeSingle();
    const cfg: any = cfgRow?.value || {};
    if (cfg.enabled === false) {
      return new Response(JSON.stringify({ skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const recipient = overrideRecipient || cfg.admin_recipient || "uday@viasetu.com";
    const senderName = cfg.sender_name || "ViaSetu Orders";
    const senderEmail = cfg.sender_email
      || Deno.env.get("SMTP_FROM_EMAIL")
      || SMTP_USER;
    const skipCc = body?.skip_cc === true;
    const cc = skipCc ? [] : (cfg.cc_recipients || "")
      .split(",").map((s: string) => s.trim()).filter(Boolean);

    // Idempotency
    const { data: booking, error: bErr } = await supabase
      .from("bookings").select("*").eq("id", booking_id).maybeSingle();
    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (booking.admin_email_sent_at && !force) {
      return new Response(JSON.stringify({ skipped: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      from: `${senderName} <${senderEmail}>`,
      to: [recipient],
      ...(cc.length ? { cc } : {}),
      subject: `🚚 New Order #${String(booking.id).slice(0, 8)} • ${booking.courier_name} • ${inr(
        Number(booking.base_fare || 0) + Number(booking.gst || 0) + Number(booking.insurance_amount || 0) + Number(booking.packaging_amount || 0),
      )}`,
      html: buildHtml(booking),
    };

    try {
      const client = new SMTPClient({
        connection: {
          hostname: SMTP_HOST,
          port: SMTP_PORT,
          tls: SMTP_PORT === 465,
          auth: { username: SMTP_USER, password: SMTP_PASS },
        },
      });
      try {
        await client.send({
          from: payload.from,
          to: payload.to,
          ...(cc.length ? { cc } : {}),
          subject: payload.subject,
          html: payload.html,
          content: "text/html",
        } as any);
      } finally {
        try { await client.close(); } catch { /* ignore */ }
      }
    } catch (sendErr) {
      console.error("[send-order-admin-email] smtp error:", sendErr);
      return new Response(JSON.stringify({ error: "Email send failed", details: String(sendErr) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("bookings")
      .update({ admin_email_sent_at: new Date().toISOString() })
      .eq("id", booking_id);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-order-admin-email] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
