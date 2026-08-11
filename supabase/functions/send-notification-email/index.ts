// Sends configurable notification emails over SMTP for application events.
// Fire-and-forget safe: never throws back to the caller's business flow.
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
const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "ViaSetu Notification";
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL") || SMTP_USER || "";

function inr(n: unknown) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function buildVars(b: Record<string, any> | null, extra: Record<string, any> = {}) {
  if (!b) {
    return {
      order_id: "SAMPLE-0000-0000",
      order_short_id: "SAMPLE00",
      awb: "TEST123456",
      courier: "Sample Courier",
      status: "CREATED",
      amount: inr(499),
      delivery_time: "2-3 days",
      sender_name: "Test Sender",
      sender_phone: "9999999999",
      sender_pincode: "411001",
      receiver_name: "Test Receiver",
      receiver_phone: "8888888888",
      receiver_pincode: "400059",
      goods_type: "Documents",
      weight: "1 kg",
      failure_reason: "-",
      refund_reason: "-",
      payment_id: "pay_TEST",
      created_at: new Date().toLocaleString("en-IN"),
      ...extra,
    };
  }
  const total =
    Number(b.base_fare || 0) +
    Number(b.gst || 0) +
    Number(b.insurance_amount || 0) +
    Number(b.packaging_amount || 0);
  return {
    order_id: String(b.id),
    order_short_id: String(b.id).slice(0, 8),
    awb: b.prayog_awb || b.tracking_id || "—",
    courier: b.courier_name || "—",
    status: b.status || "—",
    amount: inr(total),
    delivery_time: b.delivery_time || "—",
    sender_name: b.sender_name || "",
    sender_phone: b.sender_phone || "",
    sender_pincode: b.sender_pincode || "",
    receiver_name: b.receiver_name || "",
    receiver_phone: b.receiver_phone || "",
    receiver_pincode: b.receiver_pincode || "",
    goods_type: b.goods_type || "",
    weight: `${b.package_weight || ""} kg`,
    failure_reason: b.failure_reason || "—",
    refund_reason: b.refund_reason || "—",
    payment_id: b.payment_id || "—",
    created_at: new Date(b.created_at || Date.now()).toLocaleString("en-IN"),
    ...extra,
  };
}

function render(tpl: string, vars: Record<string, string>) {
  return String(tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) =>
    vars[k] !== undefined ? String(vars[k]) : ""
  );
}

function wrap(html: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7f9;padding:20px;color:#111;">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#06b6d4;color:#000;padding:16px 20px;"><h2 style="margin:0;">ViaSetu</h2></div>
    <div style="padding:20px;font-size:14px;line-height:1.6;">${html}</div>
    <div style="padding:12px 20px;background:#f3f4f6;font-size:12px;color:#666;">Automated notification from ViaSetu.</div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let logRow: Record<string, any> | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const event: string = body?.event;
    const bookingId: string | null = body?.booking_id || null;
    const isTest: boolean = body?.is_test === true;
    const overrideTo: string | null = body?.override_to || null;
    const extraVars: Record<string, any> = body?.vars || {};

    if (!event) return json({ error: "event required" }, 400);

    const { data: tpl } = await supabase
      .from("email_templates").select("*").eq("event_key", event).maybeSingle();

    if (!tpl) return json({ skipped: "no_template" });
    if (!tpl.enabled && !isTest) return json({ skipped: "disabled" });

    // Duplicate guard for real notifications
    if (!isTest && bookingId) {
      const { data: existing } = await supabase
        .from("email_logs").select("id")
        .eq("booking_id", bookingId).eq("event_key", event)
        .eq("is_test", false).eq("status", "sent").maybeSingle();
      if (existing) return json({ skipped: "duplicate" });
    }

    let booking: Record<string, any> | null = null;
    if (bookingId) {
      const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      booking = data || null;
    }

    const vars = buildVars(booking, extraVars) as Record<string, string>;
    const subject = (isTest ? "[TEST] " : "") + render(tpl.subject, vars);
    const html = wrap(render(tpl.body_html, vars));

    const to: string[] = overrideTo
      ? [overrideTo]
      : [
          ...(tpl.to_recipients || []),
          ...(tpl.send_to_customer && booking?.sender_email ? [booking.sender_email] : []),
        ].filter(Boolean);

    const cc: string[] = overrideTo ? [] : (tpl.cc_recipients || []).filter(Boolean);

    if (!to.length) return json({ skipped: "no_recipient" });

    logRow = {
      event_key: event,
      booking_id: isTest ? null : bookingId,
      to_email: to.join(", "),
      cc_emails: cc,
      reply_to: tpl.reply_to || null,
      subject,
      is_test: isTest,
      status: "sent",
    };

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      await supabase.from("email_logs").insert({
        ...logRow, status: "failed", error: "SMTP credentials not configured",
      });
      return json({ error: "SMTP not configured" }, 500);
    }

    const message = {
      from: `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`,
      to,
      ...(cc.length ? { cc } : {}),
      ...(tpl.reply_to ? { replyTo: tpl.reply_to } : {}),
      subject,
      html,
      content: "text/html",
    };

    const attempt = async (port: number) => {
      const client = new SMTPClient({
        connection: {
          hostname: SMTP_HOST!,
          port,
          tls: port === 465,
          auth: { username: SMTP_USER!, password: SMTP_PASS! },
        },
      });
      const timeout = new Promise((_r, rej) =>
        setTimeout(() => rej(new Error(`SMTP timeout on port ${port}`)), 20000)
      );
      try {
        // deno-lint-ignore no-explicit-any
        await Promise.race([client.send(message as any), timeout]);
        await client.close();
      } catch (e) {
        try { await client.close(); } catch { /* ignore */ }
        throw e;
      }
    };

    const ports = [SMTP_PORT, SMTP_PORT === 465 ? 587 : 465];
    let lastErr: unknown = null;
    let ok = false;
    for (const p of ports) {
      try {
        await attempt(p);
        ok = true;
        break;
      } catch (e) {
        lastErr = e;
        console.error(`[send-notification-email] SMTP port ${p} failed:`, String(e));
      }
    }
    if (!ok) throw lastErr ?? new Error("SMTP send failed");


    await supabase.from("email_logs").insert(logRow);
    return json({ sent: true, to, cc });
  } catch (err) {
    console.error("[send-notification-email] error:", err);
    if (logRow) {
      await supabase.from("email_logs")
        .insert({ ...logRow, status: "failed", error: String(err) })
        .then(() => {}, () => {});
    }
    return json({ error: String(err) }, 500);
  }
});
