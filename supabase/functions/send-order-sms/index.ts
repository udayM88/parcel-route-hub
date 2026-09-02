// Sends order-event SMS through the existing Fast2SMS DLT account.
// Reuses the same FAST2SMS_* secrets as the OTP flow but is a completely
// separate code path — the OTP functions are untouched.
// Fire-and-forget safe: always returns 200 with a decision payload and never
// throws back into a business flow. Every decision is written to sms_logs.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function inr(n: unknown) {
  const v = Number(n || 0);
  return `Rs.${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function tenDigit(phone: unknown): string | null {
  const d = String(phone ?? "").replace(/\D/g, "");
  const last10 = d.slice(-10);
  return /^\d{10}$/.test(last10) ? last10 : null;
}

function buildVars(b: Record<string, any> | null, extra: Record<string, any> = {}) {
  if (!b) {
    return {
      order_id: "SAMPLE00", awb: "TEST123456", courier: "Sample Courier",
      status: "CONFIRMED", amount: inr(499), delivery_time: "2-3 days",
      sender_name: "Test Sender", receiver_name: "Test Receiver",
      receiver_phone: "8888888888", failure_reason: "-", refund_reason: "-",
      tracking_url: "https://www.viasetu.com/tracking", ...extra,
    };
  }
  const total =
    Number(b.base_fare || 0) + Number(b.gst || 0) +
    Number(b.insurance_amount || 0) + Number(b.packaging_amount || 0);
  const awb = b.prayog_awb || b.tracking_id || "-";
  return {
    order_id: String(b.id).slice(0, 8).toUpperCase(),
    order_uuid: String(b.id),
    awb,
    courier: b.courier_name || "-",
    status: b.status || "-",
    amount: inr(total || b.courier_price),
    delivery_time: b.delivery_time || "-",
    sender_name: b.sender_name || "-",
    sender_phone: b.sender_phone || "-",
    receiver_name: b.receiver_name || "-",
    receiver_phone: b.receiver_phone || "-",
    receiver_pincode: b.receiver_pincode || "-",
    failure_reason: b.failure_reason || "-",
    refund_reason: b.refund_reason || "-",
    tracking_url: `https://www.viasetu.com/tracking?awb=${awb}`,
    ...extra,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let event = "";
  let bookingId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    event = String(body?.event || "").toUpperCase();
    bookingId = body?.booking_id ? String(body.booking_id) : null;
    const statusEventId: string | null = body?.status_event_id || null;
    const isTest = Boolean(body?.test);
    const extraVars: Record<string, any> = body?.vars || {};
    const overrideRecipient = tenDigit(body?.to);

    if (!event) return json({ ok: false, decision: "skipped", reason: "missing event" }, 400);

    const { data: tpl } = await admin
      .from("sms_templates").select("*").eq("event_key", event).maybeSingle();

    const log = async (row: Record<string, unknown>) => {
      await admin.from("sms_logs").insert({
        event_key: event, booking_id: bookingId, status_event_id: statusEventId,
        is_test: isTest, ...row,
      });
    };

    if (!tpl) {
      console.log(`[send-order-sms] ${event}: no template configured`);
      await log({ status: "skipped", reason: "no template configured" });
      return json({ ok: false, decision: "skipped", reason: "no template configured" });
    }
    if (!tpl.enabled) {
      console.log(`[send-order-sms] ${event}: template disabled`);
      await log({ status: "skipped", reason: "template disabled", template_id: tpl.template_id });
      return json({ ok: false, decision: "skipped", reason: "template disabled" });
    }
    if (!String(tpl.template_id || "").trim()) {
      console.log(`[send-order-sms] ${event}: no Fast2SMS template id`);
      await log({ status: "skipped", reason: "no Fast2SMS template id set" });
      return json({ ok: false, decision: "skipped", reason: "no Fast2SMS template id set" });
    }

    // Duplicate guard: the same status event must never send twice, even when
    // polling / webhook retries deliver it repeatedly.
    if (!isTest && (statusEventId || bookingId)) {
      let dup = admin.from("sms_logs").select("id")
        .eq("event_key", event).eq("status", "sent").limit(1);
      dup = statusEventId
        ? dup.eq("status_event_id", statusEventId)
        : dup.eq("booking_id", bookingId!);
      const { data: existing } = await dup;
      if (existing && existing.length) {
        console.log(`[send-order-sms] ${event} booking=${bookingId}: duplicate suppressed`);
        await log({ status: "skipped", reason: "duplicate — already sent for this status event" });
        return json({ ok: true, decision: "duplicate" });
      }
    }

    let booking: Record<string, any> | null = null;
    if (bookingId) {
      const { data } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      booking = data || null;
    }

    const vars = buildVars(booking, extraVars);
    const varNames: string[] = Array.isArray(tpl.variables) ? tpl.variables : [];
    const values = varNames.map((n) => String(vars[n] ?? "-").replace(/[|]/g, "/").slice(0, 30));

    const recipients = new Set<string>();
    if (overrideRecipient) recipients.add(overrideRecipient);
    for (const r of (tpl.recipients || [])) {
      const p = tenDigit(r);
      if (p) recipients.add(p);
    }
    if (tpl.send_to_customer && booking) {
      const p = tenDigit(booking.sender_phone);
      if (p) recipients.add(p);
    }

    if (recipients.size === 0) {
      console.log(`[send-order-sms] ${event}: no recipients configured`);
      await log({ status: "skipped", reason: "no recipients configured", template_id: tpl.template_id });
      return json({ ok: false, decision: "skipped", reason: "no recipients configured" });
    }

    const apiKey = Deno.env.get("FAST2SMS_API_KEY");
    const senderId = Deno.env.get("FAST2SMS_SENDER_ID");
    const entityId = Deno.env.get("FAST2SMS_ENTITY_ID");
    if (!apiKey || !senderId || !entityId) {
      await log({ status: "failed", reason: "Fast2SMS not configured", template_id: tpl.template_id });
      return json({ ok: false, decision: "failed", reason: "Fast2SMS not configured" });
    }

    const numbers = Array.from(recipients);
    const params = new URLSearchParams({
      authorization: apiKey,
      route: "dlt",
      sender_id: senderId,
      message: String(tpl.template_id).trim(),
      variables_values: values.join("|"),
      flash: "0",
      numbers: numbers.join(","),
      entity_id: entityId,
    });

    let resp: Response;
    let payload: any = {};
    try {
      resp = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`, { method: "GET" });
      payload = await resp.json().catch(() => ({}));
    } catch (e) {
      console.error(`[send-order-sms] ${event} network error`, String(e));
      await log({
        status: "failed", reason: `network error: ${String(e)}`,
        template_id: tpl.template_id, to_phone: numbers.join(","), variables: values,
      });
      return json({ ok: false, decision: "failed", reason: "network error" });
    }

    const ok = resp.ok && payload?.return === true;
    console.log(
      `[send-order-sms] ${event} booking=${bookingId} awb=${vars.awb} -> ${numbers.join(",")} ` +
      `template=${tpl.template_id} result=${ok ? "sent" : "failed"}`,
    );

    await log({
      status: ok ? "sent" : "failed",
      reason: ok ? null : (payload?.message ? JSON.stringify(payload.message) : `HTTP ${resp.status}`),
      template_id: String(tpl.template_id),
      to_phone: numbers.join(","),
      awb: vars.awb,
      variables: values,
      message_preview: `${tpl.template_name || tpl.label}: ${values.join(" | ")}`,
      provider_response: payload ?? null,
    });

    return json({ ok, decision: ok ? "sent" : "failed", recipients: numbers, variables: values });
  } catch (e) {
    console.error("[send-order-sms] error", event, String(e));
    return json({ ok: false, decision: "failed", reason: String(e) });
  }
});
