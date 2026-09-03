// Order-event SMS engine (Fast2SMS DLT). Completely separate from the OTP
// functions — it reuses the same Fast2SMS account/secrets but never touches
// fast2sms-send-otp / fast2sms-verify-otp.
//
// Flow: normalized courier status -> template rule -> variables -> DB-level
// duplicate claim -> Fast2SMS -> notification log (SENT / FAILED / SKIPPED).
// Failed sends are retried by `{ mode: "retry" }` (called from the existing
// status-sync cron) reusing the SAME log row, so retries never duplicate SMS.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const MAX_ATTEMPTS = 4;
const BACKOFF_MIN = [5, 15, 60, 180]; // minutes between retries

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

/** Actual Fast2SMS DLT call. Returns provider outcome, never throws. */
async function sendViaFast2Sms(
  templateId: string, values: string[], numbers: string[],
): Promise<{ ok: boolean; payload: any; reason: string | null; retryable: boolean }> {
  const apiKey = Deno.env.get("FAST2SMS_API_KEY");
  const senderId = Deno.env.get("FAST2SMS_SENDER_ID");
  const entityId = Deno.env.get("FAST2SMS_ENTITY_ID");
  if (!apiKey || !senderId || !entityId) {
    return { ok: false, payload: null, reason: "Fast2SMS not configured", retryable: false };
  }
  const params = new URLSearchParams({
    authorization: apiKey,
    route: "dlt",
    sender_id: senderId,
    message: templateId,
    variables_values: values.join("|"),
    flash: "0",
    numbers: numbers.join(","),
    entity_id: entityId,
  });
  try {
    const resp = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`, { method: "GET" });
    const payload = await resp.json().catch(() => ({}));
    const ok = resp.ok && payload?.return === true;
    // 402 = insufficient balance, 4xx = bad request/template -> not retryable.
    const retryable = !ok && (resp.status >= 500 || resp.status === 429);
    return {
      ok, payload,
      reason: ok ? null : (payload?.message ? JSON.stringify(payload.message) : `HTTP ${resp.status}`),
      retryable,
    };
  } catch (e) {
    return { ok: false, payload: null, reason: `network error: ${String(e)}`, retryable: true };
  }
}

const nextRetryAt = (attempt: number) =>
  new Date(Date.now() + (BACKOFF_MIN[Math.min(attempt, BACKOFF_MIN.length) - 1] ?? 180) * 60_000).toISOString();

/**
 * Idempotency guard used before EVERY retry (automatic or manual).
 * A notification is considered already delivered when another log row for the
 * same order/AWB/event/normalized-status (its dedupe key) is already `sent`.
 * This makes delayed provider responses, webhook retries and server restarts
 * safe: the same SMS can never go out twice.
 */
async function alreadyDelivered(admin: any, row: Record<string, any>): Promise<boolean> {
  if (row.status === "sent") return true;
  if (!row.dedupe_key) return false;
  const { data } = await admin
    .from("sms_logs")
    .select("id")
    .eq("dedupe_key", row.dedupe_key)
    .eq("status", "sent")
    .neq("id", row.id)
    .limit(1);
  return Boolean(data && data.length);
}

/** One retry attempt on an existing log row — never creates a new row. */
async function retryLogRow(
  admin: any, row: Record<string, any>, origin: "cron" | "admin",
): Promise<{ result: "sent" | "failed" | "abandoned" | "duplicate"; reason?: string }> {
  if (await alreadyDelivered(admin, row)) {
    await admin.from("sms_logs").update({
      reason: "retry skipped — notification already delivered", next_retry_at: null,
    }).eq("id", row.id).neq("status", "sent");
    console.log(`[send-order-sms][${origin}-retry] log=${row.id} duplicate suppressed`);
    return { result: "duplicate" };
  }

  const numbers = String(row.to_phone || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  const values: string[] = Array.isArray(row.variables) ? row.variables : [];
  if (!row.template_id || numbers.length === 0) {
    await admin.from("sms_logs").update({
      status: "skipped", reason: "retry abandoned — missing template or recipients", next_retry_at: null,
    }).eq("id", row.id);
    return { result: "abandoned", reason: "missing template or recipients" };
  }

  const attempt = Number(row.attempt_count || 0) + 1;
  const res = await sendViaFast2Sms(String(row.template_id), values, numbers);
  const willRetry = !res.ok && res.retryable && attempt < MAX_ATTEMPTS;
  await admin.from("sms_logs").update({
    status: res.ok ? "sent" : "failed",
    reason: res.ok
      ? null
      : `${res.reason} (${origin} attempt ${attempt}/${MAX_ATTEMPTS}${willRetry ? "" : " — max retries exhausted"})`,
    provider_response: res.payload ?? null,
    attempt_count: attempt,
    sent_at: res.ok ? new Date().toISOString() : null,
    next_retry_at: willRetry ? nextRetryAt(attempt) : null,
  }).eq("id", row.id);

  console.log(
    `[send-order-sms][${origin}-retry] log=${row.id} event=${row.event_key} booking=${row.booking_id} ` +
    `attempt=${attempt} result=${res.ok ? "sent" : "failed"}${res.reason ? ` reason=${res.reason}` : ""}`,
  );
  if (res.ok) return { result: "sent" };
  return { result: willRetry ? "failed" : "abandoned", reason: res.reason ?? undefined };
}

/** Retry sweep — re-sends previously failed notifications on the same log row. */
async function retrySweep(admin: any, limit: number) {
  const nowIso = new Date().toISOString();
  const { data: rows } = await admin
    .from("sms_logs")
    .select("*")
    .eq("status", "failed")
    .lt("attempt_count", MAX_ATTEMPTS)
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  let sent = 0, failed = 0, abandoned = 0, duplicate = 0;
  for (const row of rows || []) {
    const out = await retryLogRow(admin, row, "cron");
    if (out.result === "sent") sent++;
    else if (out.result === "failed") failed++;
    else if (out.result === "duplicate") duplicate++;
    else abandoned++;
  }
  return { processed: (rows || []).length, sent, failed, abandoned, duplicate };
}

/** Manual retry from Admin → SMS Logs. Caller must be an active admin. */
async function manualRetry(admin: any, req: Request, logId: string) {
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace("Bearer ", "").trim();
  if (!bearer) return json({ ok: false, decision: "unauthorized", reason: "Missing authorization" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(bearer);
  const uid = claims?.claims?.sub;
  if (claimsErr || !uid) return json({ ok: false, decision: "unauthorized", reason: "Invalid session" }, 401);
  const { data: adminRow } = await admin
    .from("admin_users").select("id").eq("user_id", uid).eq("is_active", true).maybeSingle();
  if (!adminRow) return json({ ok: false, decision: "forbidden", reason: "Admin access required" }, 403);

  const { data: row } = await admin.from("sms_logs").select("*").eq("id", logId).maybeSingle();
  if (!row) return json({ ok: false, decision: "not_found", reason: "Log not found" }, 404);
  if (row.status === "sent") return json({ ok: true, decision: "duplicate", reason: "Already sent" });

  const out = await retryLogRow(admin, row, "admin");
  return json({
    ok: out.result === "sent" || out.result === "duplicate",
    decision: out.result,
    reason: out.reason ?? null,
    log_id: logId,
  });
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

    if (String(body?.mode || "") === "retry") {
      const out = await retrySweep(admin, Math.min(Number(body?.limit) || 25, 100));
      console.log(`[send-order-sms][retry] sweep`, JSON.stringify(out));
      return json({ ok: true, decision: "retry_sweep", ...out });
    }

    event = String(body?.event || "").toUpperCase();
    bookingId = body?.booking_id ? String(body.booking_id) : null;
    const statusEventId: string | null = body?.status_event_id || null;
    const isTest = Boolean(body?.test);
    const extraVars: Record<string, any> = body?.vars || {};
    const overrideRecipient = tenDigit(body?.to);

    if (!event) return json({ ok: false, decision: "skipped", reason: "missing event" }, 400);

    const { data: tpl } = await admin
      .from("sms_templates").select("*").eq("event_key", event).maybeSingle();

    let booking: Record<string, any> | null = null;
    if (bookingId) {
      const { data } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      booking = data || null;
    }

    const awbForLog = booking?.prayog_awb || booking?.tracking_id || null;
    const rawStatus = extraVars.courier_status ?? extraVars.status ?? null;

    const log = async (row: Record<string, unknown>) => {
      await admin.from("sms_logs").insert({
        event_key: event, booking_id: bookingId, status_event_id: statusEventId,
        is_test: isTest, awb: awbForLog, courier_name: booking?.courier_name ?? null,
        raw_status: rawStatus ? String(rawStatus) : null,
        normalized_status: body?.normalized_status ? String(body.normalized_status) : null,
        ...row,
      });
    };

    if (!tpl) {
      console.log(`[send-order-sms] ${event}: no notification rule configured`);
      await log({ status: "skipped", reason: "no template configured" });
      return json({ ok: false, decision: "skipped", reason: "no template configured" });
    }
    if (!tpl.enabled) {
      console.log(`[send-order-sms] ${event}: rule disabled`);
      await log({ status: "skipped", reason: "template disabled", template_id: tpl.template_id });
      return json({ ok: false, decision: "skipped", reason: "template disabled" });
    }
    if (!String(tpl.template_id || "").trim()) {
      console.log(`[send-order-sms] ${event}: no Fast2SMS template id`);
      await log({ status: "skipped", reason: "no Fast2SMS template id set" });
      return json({ ok: false, decision: "skipped", reason: "no Fast2SMS template id set" });
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

    const numbers = Array.from(recipients);

    // ---- Duplicate protection (database-enforced) -------------------------
    // One SMS per order/AWB/event/status-event. A unique index on dedupe_key
    // makes concurrent webhook + polling deliveries collide instead of double
    // sending. The claim row is inserted BEFORE the provider call.
    const dedupeKey = isTest
      ? null
      : [event, bookingId ?? "-", awbForLog ?? "-", statusEventId ?? String(rawStatus ?? "-")].join("|");

    const { data: claim, error: claimErr } = await admin
      .from("sms_logs")
      .insert({
        event_key: event,
        booking_id: bookingId,
        status_event_id: statusEventId,
        is_test: isTest,
        dedupe_key: dedupeKey,
        awb: awbForLog,
        courier_name: booking?.courier_name ?? null,
        raw_status: rawStatus ? String(rawStatus) : null,
        normalized_status: body?.normalized_status ? String(body.normalized_status) : null,
        template_id: String(tpl.template_id).trim(),
        to_phone: numbers.join(","),
        variables: values,
        message_preview: `${tpl.template_name || tpl.label}: ${values.join(" | ")}`,
        status: "sending",
        attempt_count: 0,
      })
      .select("id")
      .maybeSingle();

    if (claimErr) {
      const duplicate = String(claimErr.code) === "23505";
      console.log(
        `[send-order-sms] ${event} booking=${bookingId} awb=${awbForLog}: ` +
        (duplicate ? "duplicate suppressed" : `claim failed: ${claimErr.message}`),
      );
      if (duplicate) return json({ ok: true, decision: "duplicate" });
      await log({ status: "failed", reason: `log claim failed: ${claimErr.message}` });
      return json({ ok: false, decision: "failed", reason: "log claim failed" });
    }

    const logId = claim?.id;
    const res = await sendViaFast2Sms(String(tpl.template_id).trim(), values, numbers);
    const willRetry = !res.ok && res.retryable;

    await admin.from("sms_logs").update({
      status: res.ok ? "sent" : "failed",
      reason: res.ok ? null : `${res.reason} (attempt 1/${MAX_ATTEMPTS})`,
      provider_response: res.payload ?? null,
      attempt_count: 1,
      sent_at: res.ok ? new Date().toISOString() : null,
      next_retry_at: willRetry ? nextRetryAt(1) : null,
    }).eq("id", logId);

    console.log(
      `[send-order-sms] ${event} booking=${bookingId} awb=${vars.awb} courier=${vars.courier} ` +
      `raw="${rawStatus ?? "-"}" -> ${numbers.join(",")} template=${tpl.template_id} ` +
      `result=${res.ok ? "sent" : "failed"}${res.reason ? ` reason=${res.reason}` : ""}` +
      `${willRetry ? " (queued for retry)" : ""}`,
    );

    return json({
      ok: res.ok,
      decision: res.ok ? "sent" : (willRetry ? "failed_retry_queued" : "failed"),
      recipients: numbers, variables: values, log_id: logId,
    });
  } catch (e) {
    console.error("[send-order-sms] error", event, String(e));
    return json({ ok: false, decision: "failed", reason: String(e) });
  }
});
