/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validTypes = new Set(["nps", "stars", "single", "multi", "text"]);
const validSections = new Set(["overall", "order", "comparison", "future"]);

type Question = {
  id: string;
  title: string;
  helper?: string;
  section: string;
  type: string;
  options?: string[];
  required?: boolean;
  maxLength?: number;
  otherAnswerKey?: string;
};

const digest = async (value: string) => {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};
const tenDigit = (phone: unknown) => {
  const value = String(phone ?? "")
    .replace(/\D/g, "")
    .slice(-10);
  return /^\d{10}$/.test(value) ? value : null;
};
const emailAddress = (value: unknown) => {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? email
    : null;
};
const emailMask = (value: unknown) => {
  const email = emailAddress(value);
  if (!email) return "—";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"•".repeat(Math.min(Math.max(local.length - 1, 2), 8))}@${domain}`;
};
const safeBaseUrl = (value: unknown) => {
  let parsed: URL;
  try {
    parsed = new URL(String(value || "").replace(/\/$/, ""));
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  )
    return null;
  return parsed.origin;
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] || character,
  );
const renderCopy = (
  template: string,
  values: { firstName: string; orderReference: string; link: string },
) =>
  template
    .replaceAll("{first_name}", values.firstName)
    .replaceAll("{order_reference}", values.orderReference)
    .replaceAll("{link}", values.link);

function validateQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50)
    throw new Error("invalid_questions");
  const ids = new Set<string>();
  return raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("invalid_question");
    const input = item as Record<string, unknown>;
    const id = String(input.id || "").trim();
    const title = String(input.title || "").trim();
    const type = String(input.type || "");
    const section = String(input.section || "order");
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(id) || ids.has(id))
      throw new Error("invalid_question_id");
    if (
      !title ||
      title.length > 240 ||
      !validTypes.has(type) ||
      !validSections.has(section)
    )
      throw new Error("invalid_question");
    ids.add(id);
    const question: Question = {
      id,
      title,
      type,
      section,
      required: Boolean(input.required),
    };
    if (typeof input.helper === "string" && input.helper.trim())
      question.helper = input.helper.trim().slice(0, 300);
    if (type === "single" || type === "multi") {
      if (!Array.isArray(input.options))
        throw new Error("invalid_question_options");
      const options = [
        ...new Set(
          input.options.map((option) => String(option).trim()).filter(Boolean),
        ),
      ].slice(0, 25);
      if (options.length < 2 || options.some((option) => option.length > 120))
        throw new Error("invalid_question_options");
      question.options = options;
      if (options.includes("Other")) question.otherAnswerKey = `${id}_other`;
    }
    if (type === "text")
      question.maxLength = Math.min(
        Math.max(Number(input.maxLength) || 1000, 100),
        2000,
      );
    return question;
  });
}

function cleanAnswers(raw: unknown, questions: Question[]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("invalid_answers");
  const source = raw as Record<string, unknown>;
  const answers: Record<string, string | number | string[]> = {};
  for (const question of questions) {
    const value = source[question.id];
    if (
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      if (question.required) throw new Error(`missing_${question.id}`);
      continue;
    }
    if (question.type === "nps" || question.type === "stars") {
      if (typeof value !== "number" || !Number.isInteger(value))
        throw new Error(`invalid_${question.id}`);
      if (
        (question.type === "nps" && (value < 0 || value > 10)) ||
        (question.type === "stars" && (value < 1 || value > 5))
      )
        throw new Error(`invalid_${question.id}`);
      answers[question.id] = value;
    } else if (question.type === "single") {
      if (typeof value !== "string" || !question.options?.includes(value))
        throw new Error(`invalid_${question.id}`);
      answers[question.id] = value;
    } else if (question.type === "multi") {
      if (
        !Array.isArray(value) ||
        value.some(
          (entry) =>
            typeof entry !== "string" || !question.options?.includes(entry),
        )
      )
        throw new Error(`invalid_${question.id}`);
      answers[question.id] = [...new Set(value as string[])].slice(0, 25);
    } else {
      if (typeof value !== "string") throw new Error(`invalid_${question.id}`);
      answers[question.id] = value.trim().slice(0, question.maxLength || 1000);
    }
    const hasOther = Array.isArray(answers[question.id])
      ? (answers[question.id] as string[]).includes("Other")
      : answers[question.id] === "Other";
    if (hasOther && question.otherAnswerKey) {
      const other = source[question.otherAnswerKey];
      if (typeof other !== "string" || !other.trim())
        throw new Error(`missing_${question.otherAnswerKey}`);
      answers[question.otherAnswerKey] = other.trim().slice(0, 300);
    }
  }
  if (JSON.stringify(answers).length > 30_000)
    throw new Error("answers_too_large");
  return answers;
}

async function requireSuperAdmin(req: Request, adminClient: any) {
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return null;
  const { data, error } = await adminClient.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: admin } = await adminClient
    .from("admin_users")
    .select("role,is_active")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();
  return admin?.role === "super_admin" ? data.user : null;
}

async function createInvitation(
  admin: any,
  survey: any,
  booking: any,
  createdBy: string,
) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await admin
    .from("feedback_invitations")
    .update({ revoked_at: now.toISOString() })
    .eq("survey_id", survey.id)
    .eq("booking_id", booking.id)
    .is("used_at", null)
    .is("revoked_at", null);
  const token = randomToken();
  const { data, error } = await admin
    .from("feedback_invitations")
    .insert({
      survey_id: survey.id,
      booking_id: booking.id,
      user_id: booking.user_id,
      token_hash: await digest(token),
      expires_at: expiresAt,
      created_by: createdBy,
    })
    .select("id,expires_at")
    .single();
  if (error) throw error;
  return { token, id: data.id, expiresAt: data.expires_at };
}

async function getAccountEmail(admin: any, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return emailAddress(data?.email);
}

async function claimDelivery(
  admin: any,
  input: {
    campaignId?: string | null;
    invitationId: string;
    surveyId: string;
    bookingId: string;
    userId: string;
    channel: "sms" | "email";
    recipientMasked: string;
    createdBy: string;
  },
) {
  const { data, error } = await admin
    .from("feedback_deliveries")
    .insert({
      campaign_id: input.campaignId || null,
      invitation_id: input.invitationId,
      survey_id: input.surveyId,
      booking_id: input.bookingId,
      user_id: input.userId,
      channel: input.channel,
      recipient_masked: input.recipientMasked,
      status: "sending",
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { duplicate: true, id: null };
  if (error) throw error;
  return { duplicate: false, id: data.id as string };
}

async function finishDelivery(
  admin: any,
  deliveryId: string | null,
  result: {
    status: "sent" | "failed" | "skipped" | "duplicate";
    providerLogId?: string | null;
    error?: string | null;
  },
) {
  if (!deliveryId) return;
  await admin
    .from("feedback_deliveries")
    .update({
      status: result.status,
      provider_log_id: result.providerLogId || null,
      error: result.error?.slice(0, 1000) || null,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", deliveryId);
}

async function sendFeedbackSms(
  admin: any,
  survey: any,
  booking: any,
  invitationId: string,
  link: string,
  createdBy: string,
  campaignId: string | null = null,
) {
  const apiKey = Deno.env.get("FAST2SMS_API_KEY");
  const senderId = Deno.env.get("FAST2SMS_SENDER_ID");
  const entityId = Deno.env.get("FAST2SMS_ENTITY_ID");
  const phone = tenDigit(booking.receiver_phone);
  if (!survey.dlt_template_id)
    return {
      ok: false,
      reason: "Approved DLT template ID is not configured",
      retryable: false,
    };
  if (!apiKey || !senderId || !entityId)
    return {
      ok: false,
      reason: "Fast2SMS is not configured",
      retryable: false,
    };
  if (!phone)
    return {
      ok: false,
      reason: "Customer phone number is invalid",
      retryable: false,
    };

  const delivery = await claimDelivery(admin, {
    campaignId,
    invitationId,
    surveyId: survey.id,
    bookingId: booking.id,
    userId: booking.user_id,
    channel: "sms",
    recipientMasked: phoneMask(phone),
    createdBy,
  });
  if (delivery.duplicate)
    return { ok: true, duplicate: true, reason: null, retryable: false };

  const dedupeKey = `FEEDBACK_SURVEY|${invitationId}`;
  const { data: claim, error: claimError } = await admin
    .from("sms_logs")
    .insert({
      event_key: "FEEDBACK_SURVEY",
      booking_id: booking.id,
      dedupe_key: dedupeKey,
      template_id: survey.dlt_template_id,
      to_phone: phone,
      variables: [link],
      message_preview: survey.sms_template.replace("{#var#}", link),
      status: "sending",
      attempt_count: 0,
    })
    .select("id")
    .single();
  if (claimError) {
    const duplicate = claimError.code === "23505";
    await finishDelivery(admin, delivery.id, {
      status: duplicate ? "duplicate" : "failed",
      error: duplicate ? null : "Could not create SMS audit log",
    });
    return {
      ok: duplicate,
      duplicate,
      reason: duplicate ? null : "Could not create SMS audit log",
      retryable: false,
    };
  }
  const params = new URLSearchParams({
    authorization: apiKey,
    route: "dlt",
    sender_id: senderId,
    message: survey.dlt_template_id,
    variables_values: link.replace(/\|/g, "%7C"),
    flash: "0",
    numbers: phone,
    entity_id: entityId,
  });
  try {
    const response = await fetch(
      `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`,
      { method: "GET" },
    );
    const payload = await response.json().catch(() => ({}));
    const ok = response.ok && payload?.return === true;
    const reason = ok
      ? null
      : payload?.message
        ? JSON.stringify(payload.message)
        : `HTTP ${response.status}`;
    const retryable =
      !ok && (response.status >= 500 || response.status === 429);
    await admin
      .from("sms_logs")
      .update({
        status: ok ? "sent" : "failed",
        reason,
        provider_response: payload,
        attempt_count: 1,
        sent_at: ok ? new Date().toISOString() : null,
        next_retry_at: retryable
          ? new Date(Date.now() + 5 * 60_000).toISOString()
          : null,
      })
      .eq("id", claim.id);
    await finishDelivery(admin, delivery.id, {
      status: ok ? "sent" : "failed",
      providerLogId: claim.id,
      error: reason,
    });
    return { ok, reason, retryable, logId: claim.id };
  } catch (error) {
    const reason = `Network error: ${String(error)}`;
    await admin
      .from("sms_logs")
      .update({
        status: "failed",
        reason,
        attempt_count: 1,
        next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq("id", claim.id);
    await finishDelivery(admin, delivery.id, {
      status: "failed",
      providerLogId: claim.id,
      error: reason,
    });
    return { ok: false, reason, retryable: true, logId: claim.id };
  }
}

async function sendFeedbackEmail(
  admin: any,
  survey: any,
  booking: any,
  invitationId: string,
  link: string,
  createdBy: string,
  campaignId: string | null = null,
) {
  const recipient = await getAccountEmail(admin, booking.user_id);
  if (!recipient)
    return { ok: false, reason: "Order account email is unavailable" };
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpUser = Deno.env.get("SMTP_USERNAME") || Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASSWORD") || Deno.env.get("SMTP_PASS");
  const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
  if (!smtpHost || !smtpUser || !smtpPass)
    return { ok: false, reason: "Email service is not configured" };

  const delivery = await claimDelivery(admin, {
    campaignId,
    invitationId,
    surveyId: survey.id,
    bookingId: booking.id,
    userId: booking.user_id,
    channel: "email",
    recipientMasked: emailMask(recipient),
    createdBy,
  });
  if (delivery.duplicate) return { ok: true, duplicate: true, reason: null };

  const firstName = String(booking.receiver_name || "Customer")
    .trim()
    .split(/\s+/)[0]
    .slice(0, 50);
  const values = {
    firstName,
    orderReference: booking.id.slice(-8).toUpperCase(),
    link,
  };
  const subject = renderCopy(
    String(survey.email_subject || "ViaSetu feedback"),
    values,
  )
    .replace(/[\r\n]+/g, " ")
    .slice(0, 160);
  const plainBody = renderCopy(
    String(survey.email_template || "{link}"),
    values,
  );
  const escapedLink = escapeHtml(link);
  const bodyHtml = escapeHtml(plainBody)
    .replaceAll("\n", "<br>")
    .replaceAll(
      escapedLink,
      `<a href="${escapedLink}" style="color:#117b78;font-weight:700;">Open your secure feedback form</a>`,
    );
  const html = `<!doctype html><html><body style="margin:0;background:#eef5f5;font-family:Arial,sans-serif;color:#102b3f;"><div style="max-width:640px;margin:0 auto;padding:28px 16px;"><div style="background:#102b3f;color:#fff;padding:22px 26px;font-size:24px;font-weight:700;">ViaSetu</div><div style="background:#fff;border:1px solid #d8e4e4;padding:28px 26px;font-size:15px;line-height:1.7;">${bodyHtml}</div><div style="padding:14px 4px;color:#65797e;font-size:12px;">This secure feedback link is single-use and expires in 30 days.</div></div></body></html>`;

  const logBase = {
    event_key: "FEEDBACK_SURVEY",
    booking_id: booking.id,
    to_email: recipient,
    cc_emails: [],
    reply_to: null,
    subject,
    is_test: false,
    triggered_by: createdBy,
  };
  let lastError: unknown = null;
  for (const port of [...new Set([smtpPort, 587, 2525, 465])]) {
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port,
        tls: port === 465,
        auth: { username: smtpUser, password: smtpPass },
      },
    });
    try {
      await Promise.race([
        client.send({
          from: `${Deno.env.get("SMTP_FROM_NAME") || "ViaSetu"} <${Deno.env.get("SMTP_FROM_EMAIL") || smtpUser}>`,
          to: [recipient],
          subject,
          html,
          content: "text/html",
        } as any),
        new Promise((_resolve, reject) =>
          setTimeout(
            () => reject(new Error(`SMTP timeout on port ${port}`)),
            12_000,
          ),
        ),
      ]);
      await client.close();
      const { data: emailLog } = await admin
        .from("email_logs")
        .insert({
          ...logBase,
          status: "sent",
          provider_response: { transport: `smtp:${port}` },
        })
        .select("id")
        .single();
      await finishDelivery(admin, delivery.id, {
        status: "sent",
        providerLogId: emailLog?.id || null,
      });
      return { ok: true, reason: null, logId: emailLog?.id || null };
    } catch (error) {
      lastError = error;
      try {
        await client.close();
      } catch {
        // Ignore close failures and retain the transport error.
      }
    }
  }
  const reason = String(lastError || "Email delivery failed").slice(0, 1000);
  const { data: emailLog } = await admin
    .from("email_logs")
    .insert({ ...logBase, status: "failed", error: reason })
    .select("id")
    .single();
  await finishDelivery(admin, delivery.id, {
    status: "failed",
    providerLogId: emailLog?.id || null,
    error: reason,
  });
  return { ok: false, reason, logId: emailLog?.id || null };
}

async function loadAudience(admin: any, rawLimit: unknown, rawSearch: unknown) {
  const limit = Math.min(Math.max(Number(rawLimit) || 100, 1), 200);
  const search = String(rawSearch || "")
    .trim()
    .toLowerCase()
    .slice(0, 100);
  const { data: rows, error } = await admin
    .from("bookings")
    .select(
      "id,user_id,receiver_name,receiver_phone,status,payment_status,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  const eligible = (rows || []).filter(
    (row: any) =>
      !/cancel|failed|refund/i.test(String(row.status || "")) &&
      (!search ||
        String(row.id).toLowerCase().includes(search) ||
        String(row.receiver_name || "")
          .toLowerCase()
          .includes(search) ||
        String(row.receiver_phone || "").includes(search)),
  );
  const userIds = [...new Set(eligible.map((row: any) => row.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await admin
        .from("profiles")
        .select("user_id,email")
        .in("user_id", userIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const emailByUser = new Map(
    (profiles || []).map((profile: any) => [
      profile.user_id,
      emailAddress(profile.email),
    ]),
  );
  return eligible.slice(0, limit).map((booking: any) => {
    const accountEmail = emailByUser.get(booking.user_id) || null;
    const phone = tenDigit(booking.receiver_phone);
    return {
      id: booking.id,
      user_id: booking.user_id,
      receiver_name: String(booking.receiver_name || "Customer").slice(0, 120),
      masked_phone: phone ? phoneMask(phone) : "—",
      masked_email: accountEmail ? emailMask(accountEmail) : "—",
      has_sms: Boolean(phone),
      has_email: Boolean(accountEmail),
      status: booking.status,
      payment_status: booking.payment_status,
      created_at: booking.created_at,
    };
  });
}

async function suggestCampaignCopy(survey: any, audience: any[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey)
    return { available: false, reason: "AI service is not configured" };
  const smsReady = audience.filter((item) => item.has_sms).length;
  const emailReady = audience.filter((item) => item.has_email).length;
  const prompt = `Create concise feedback campaign copy for ViaSetu, an Indian logistics platform. Return JSON only with keys campaign_name, email_subject, email_template, audience_note. The email_template must be plain text, under 700 characters, and include exactly these placeholders: {first_name}, {order_reference}, {link}. Do not add offers, claims, urgency, or personal data. Do not generate SMS copy because the SMS template is DLT-approved. Form title: ${JSON.stringify(String(survey.title).slice(0, 120))}. Form description: ${JSON.stringify(String(survey.description || "").slice(0, 300))}. Audience aggregate: ${audience.length} eligible orders, ${smsReady} with delivery phone, ${emailReady} with account email.`;
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You write factual, consent-aware customer feedback campaign copy. Return valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    },
  );
  if (!response.ok)
    return {
      available: false,
      reason: `AI service returned HTTP ${response.status}`,
    };
  const payload = await response.json();
  const content = String(payload?.choices?.[0]?.message?.content || "");
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return { available: false, reason: "AI response was not usable" };
  const suggestion = JSON.parse(match[0]);
  const emailTemplate = String(suggestion.email_template || "").slice(0, 4000);
  if (
    !emailTemplate.includes("{first_name}") ||
    !emailTemplate.includes("{order_reference}") ||
    !emailTemplate.includes("{link}")
  )
    return {
      available: false,
      reason: "AI response missed required placeholders",
    };
  return {
    available: true,
    suggestion: {
      campaign_name: String(
        suggestion.campaign_name || "Feedback campaign",
      ).slice(0, 120),
      email_subject: String(
        suggestion.email_subject || "Tell us about your ViaSetu order",
      )
        .replace(/[\r\n]+/g, " ")
        .slice(0, 160),
      email_template: emailTemplate,
      audience_note: String(suggestion.audience_note || "").slice(0, 500),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey)
    return json({ error: "service_unavailable" }, 503);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === "public_status" || body.action === "public_submit") {
      const slug = String(body.slug || "")
        .trim()
        .toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))
        return json({ available: false, error: "invalid_form" }, 404);
      const { data: survey, error: surveyError } = await admin
        .from("feedback_surveys")
        .select(
          "id,slug,form_type,title,description,status,estimated_minutes,sms_template,questions,version,public_enabled",
        )
        .eq("slug", slug)
        .eq("status", "published")
        .eq("public_enabled", true)
        .maybeSingle();
      if (surveyError) throw surveyError;
      if (!survey)
        return json({ available: false, error: "form_unavailable" }, 404);
      const questions = validateQuestions(survey.questions);
      if (body.action === "public_status")
        return json({
          available: true,
          survey: { ...survey, questions },
          mode: "shared",
        });
      if (String(body.company || "").length > 0) return json({ success: true });
      const answers = cleanAnswers(body.answers, questions);
      const elapsed = Number(body.client_elapsed_ms);
      if (!Number.isFinite(elapsed) || elapsed < 2500 || elapsed > 86_400_000)
        return json({ error: "invalid_submission_timing" }, 400);
      const ip = (
        req.headers.get("x-forwarded-for") ||
        req.headers.get("cf-connecting-ip") ||
        "unknown"
      )
        .split(",")[0]
        .trim();
      const agent = (req.headers.get("user-agent") || "unknown").slice(0, 300);
      const fingerprint = await digest(
        `${ip}|${agent}|shared|${survey.slug}|${serviceKey.slice(-16)}`,
      );
      const { count, error: countError } = await admin
        .from("feedback_responses")
        .select("id", { count: "exact", head: true })
        .eq("submission_fingerprint", fingerprint)
        .gte("submitted_at", new Date(Date.now() - 60 * 60_000).toISOString());
      if (countError) throw countError;
      if ((count ?? 0) >= 10) return json({ error: "rate_limited" }, 429);
      const { data: response, error: responseError } = await admin
        .from("feedback_responses")
        .insert({
          survey_id: survey.id,
          invitation_id: null,
          booking_id: null,
          answers,
          nps_score:
            answers.nps_score == null ? null : Number(answers.nps_score),
          overall_rating:
            answers.overall_rating == null
              ? null
              : Number(answers.overall_rating),
          source: "shared",
          submission_fingerprint: fingerprint,
          client_elapsed_ms: Math.round(elapsed),
        })
        .select("id")
        .single();
      if (responseError) throw responseError;
      return json({ success: true, response_id: response.id }, 201);
    }

    if (
      [
        "create_invite",
        "send_invite_sms",
        "send_invite_email",
        "audience_preview",
        "channel_status",
        "suggest_campaign",
        "bulk_send",
        "save_survey",
        "update_survey",
      ].includes(body.action)
    ) {
      const user = await requireSuperAdmin(req, admin);
      if (!user) return json({ error: "not_authorized" }, 403);

      if (body.action === "audience_preview") {
        const audience = await loadAudience(admin, body.limit, body.search);
        return json({ success: true, audience });
      }

      if (body.action === "channel_status") {
        const surveyId = String(body.survey_id || "");
        const { data: selectedSurvey } = uuid.test(surveyId)
          ? await admin
              .from("feedback_surveys")
              .select("dlt_template_id")
              .eq("id", surveyId)
              .maybeSingle()
          : { data: null };
        return json({
          success: true,
          channels: {
            sms:
              Boolean(Deno.env.get("FAST2SMS_API_KEY")) &&
              Boolean(Deno.env.get("FAST2SMS_SENDER_ID")) &&
              Boolean(Deno.env.get("FAST2SMS_ENTITY_ID")) &&
              Boolean(selectedSurvey?.dlt_template_id),
            email:
              Boolean(Deno.env.get("SMTP_HOST")) &&
              Boolean(
                Deno.env.get("SMTP_USERNAME") || Deno.env.get("SMTP_USER"),
              ) &&
              Boolean(
                Deno.env.get("SMTP_PASSWORD") || Deno.env.get("SMTP_PASS"),
              ),
            ai: Boolean(Deno.env.get("LOVABLE_API_KEY")),
          },
        });
      }

      if (body.action === "suggest_campaign") {
        const surveyId = String(body.survey_id || "");
        if (!uuid.test(surveyId))
          return json({ error: "invalid_survey_id" }, 400);
        const [{ data: selectedSurvey, error: surveyError }, audience] =
          await Promise.all([
            admin
              .from("feedback_surveys")
              .select("id,title,description")
              .eq("id", surveyId)
              .maybeSingle(),
            loadAudience(admin, 100, ""),
          ]);
        if (surveyError) throw surveyError;
        if (!selectedSurvey) return json({ error: "survey_unavailable" }, 404);
        const suggestion = await suggestCampaignCopy(selectedSurvey, audience);
        return json(
          { success: suggestion.available, ...suggestion },
          suggestion.available ? 200 : 503,
        );
      }

      if (body.action === "save_survey" || body.action === "update_survey") {
        const questions = validateQuestions(body.survey?.questions);
        const title = String(body.survey?.title || "")
          .trim()
          .slice(0, 120);
        const description = String(body.survey?.description || "")
          .trim()
          .slice(0, 500);
        const smsTemplate = String(body.survey?.sms_template || "")
          .trim()
          .slice(0, 500);
        const dltTemplateId =
          String(body.survey?.dlt_template_id || "")
            .trim()
            .slice(0, 100) || null;
        const emailSubject = String(body.survey?.email_subject || "")
          .trim()
          .replace(/[\r\n]+/g, " ")
          .slice(0, 160);
        const emailTemplate = String(body.survey?.email_template || "")
          .trim()
          .slice(0, 4000);
        if (
          !title ||
          !smsTemplate.includes("{#var#}") ||
          !emailSubject ||
          !emailTemplate.includes("{link}")
        )
          return json({ error: "invalid_survey" }, 400);
        const row = {
          title,
          description,
          status: ["draft", "published", "paused"].includes(body.survey?.status)
            ? body.survey.status
            : "draft",
          estimated_minutes: Math.min(
            Math.max(Number(body.survey?.estimated_minutes) || 3, 1),
            30,
          ),
          question_count: questions.length,
          questions,
          sms_template: smsTemplate,
          dlt_template_id: dltTemplateId,
          email_subject: emailSubject,
          email_template: emailTemplate,
          public_enabled: Boolean(body.survey?.public_enabled),
          updated_at: new Date().toISOString(),
        };
        if (body.action === "update_survey") {
          const id = String(body.survey?.id || "");
          if (!uuid.test(id)) return json({ error: "invalid_survey_id" }, 400);
          const { data, error } = await admin
            .from("feedback_surveys")
            .update(row)
            .eq("id", id)
            .select("*")
            .single();
          if (error) throw error;
          return json({ success: true, survey: data });
        }
        const base =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 45) || "custom-form";
        const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
        const { data, error } = await admin
          .from("feedback_surveys")
          .insert({
            ...row,
            slug,
            form_type: "custom",
            version: 1,
            created_by: user.id,
          })
          .select("*")
          .single();
        if (error) throw error;
        return json({ success: true, survey: data }, 201);
      }

      if (body.action === "bulk_send") {
        const surveyId = String(body.survey_id || "").trim();
        const baseUrl = safeBaseUrl(body.base_url);
        const channels = [
          ...new Set(
            (Array.isArray(body.channels) ? body.channels : []).map(String),
          ),
        ].filter((channel) => channel === "sms" || channel === "email") as (
          "sms" | "email"
        )[];
        const bookingIds = [
          ...new Set(
            (Array.isArray(body.booking_ids) ? body.booking_ids : []).map(
              String,
            ),
          ),
        ].filter((id) => uuid.test(id));
        if (
          !uuid.test(surveyId) ||
          !baseUrl ||
          !channels.length ||
          !bookingIds.length ||
          bookingIds.length > 25
        )
          return json({ error: "invalid_campaign" }, 400);
        const [
          { data: selectedSurvey, error: surveyError },
          { data: rows, error: bookingError },
        ] = await Promise.all([
          admin
            .from("feedback_surveys")
            .select("*")
            .eq("id", surveyId)
            .eq("status", "published")
            .maybeSingle(),
          admin
            .from("bookings")
            .select(
              "id,user_id,receiver_name,receiver_phone,status,payment_status,created_at",
            )
            .in("id", bookingIds),
        ]);
        if (surveyError || bookingError) throw surveyError || bookingError;
        if (!selectedSurvey) return json({ error: "survey_unavailable" }, 409);
        if (
          channels.includes("sms") &&
          (!selectedSurvey.dlt_template_id ||
            !Deno.env.get("FAST2SMS_API_KEY") ||
            !Deno.env.get("FAST2SMS_SENDER_ID") ||
            !Deno.env.get("FAST2SMS_ENTITY_ID"))
        )
          return json({ error: "sms_not_configured" }, 409);
        if (
          channels.includes("email") &&
          (!Deno.env.get("SMTP_HOST") ||
            !(Deno.env.get("SMTP_USERNAME") || Deno.env.get("SMTP_USER")) ||
            !(Deno.env.get("SMTP_PASSWORD") || Deno.env.get("SMTP_PASS")))
        )
          return json({ error: "email_not_configured" }, 409);
        const eligible = (rows || []).filter(
          (booking: any) =>
            !/cancel|failed|refund/i.test(String(booking.status || "")),
        );
        const dryRun = body.dry_run === true;
        if (dryRun) {
          const userIds = [
            ...new Set(eligible.map((item: any) => item.user_id)),
          ];
          const { data: profiles } = userIds.length
            ? await admin
                .from("profiles")
                .select("user_id,email")
                .in("user_id", userIds)
            : { data: [] };
          const emails = new Map(
            (profiles || []).map((item: any) => [
              item.user_id,
              emailAddress(item.email),
            ]),
          );
          return json({
            success: true,
            dry_run: true,
            requested: bookingIds.length,
            eligible: eligible.length,
            sms_ready: eligible.filter((item: any) =>
              tenDigit(item.receiver_phone),
            ).length,
            email_ready: eligible.filter((item: any) =>
              emails.get(item.user_id),
            ).length,
          });
        }

        const campaignName = String(
          body.campaign_name || `${selectedSurvey.title} campaign`,
        )
          .trim()
          .slice(0, 120);
        const { data: campaign, error: campaignError } = await admin
          .from("feedback_campaigns")
          .insert({
            survey_id: selectedSurvey.id,
            name: campaignName || "Feedback campaign",
            channels,
            requested_count: bookingIds.length,
            audience_summary: {
              requested: bookingIds.length,
              eligible: eligible.length,
            },
            created_by: user.id,
          })
          .select("id")
          .single();
        if (campaignError) throw campaignError;

        const results: Array<Record<string, unknown>> = [];
        let cursor = 0;
        const worker = async () => {
          while (cursor < eligible.length) {
            const booking = eligible[cursor++];
            const invitation = await createInvitation(
              admin,
              selectedSurvey,
              booking,
              user.id,
            );
            const root = `${baseUrl}/feedback/${selectedSurvey.slug}?token=${encodeURIComponent(invitation.token)}`;
            const outcomes: Record<string, unknown> = {};
            if (channels.includes("sms"))
              outcomes.sms = await sendFeedbackSms(
                admin,
                selectedSurvey,
                booking,
                invitation.id,
                `${root}&source=sms`,
                user.id,
                campaign.id,
              );
            if (channels.includes("email"))
              outcomes.email = await sendFeedbackEmail(
                admin,
                selectedSurvey,
                booking,
                invitation.id,
                `${root}&source=email`,
                user.id,
                campaign.id,
              );
            results.push({
              booking_id: booking.id,
              order_reference: booking.id.slice(-8).toUpperCase(),
              outcomes,
            });
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(3, eligible.length) }, () => worker()),
        );
        const outcomes = results.flatMap((item: any) =>
          Object.values(item.outcomes || {}),
        ) as Array<any>;
        const sent = outcomes.filter((item) => item?.ok).length;
        const failed = outcomes.filter((item) => !item?.ok).length;
        const skipped = bookingIds.length - eligible.length;
        const status =
          sent > 0 && failed === 0
            ? "completed"
            : sent > 0
              ? "partial"
              : "failed";
        await admin
          .from("feedback_campaigns")
          .update({
            sent_count: sent,
            failed_count: failed,
            skipped_count: skipped,
            status,
            completed_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);
        return json(
          {
            success: failed === 0,
            campaign_id: campaign.id,
            status,
            requested: bookingIds.length,
            sent,
            failed,
            skipped,
            results,
          },
          failed === 0 ? 201 : 207,
        );
      }

      const bookingId = String(body.booking_id || "").trim();
      const surveyId = String(body.survey_id || "").trim();
      if (!uuid.test(bookingId) || !uuid.test(surveyId))
        return json({ error: "invalid_request" }, 400);
      const [
        { data: booking, error: bookingError },
        { data: survey, error: surveyError },
      ] = await Promise.all([
        admin
          .from("bookings")
          .select(
            "id,user_id,receiver_name,receiver_phone,status,payment_status",
          )
          .eq("id", bookingId)
          .maybeSingle(),
        admin
          .from("feedback_surveys")
          .select("*")
          .eq("id", surveyId)
          .eq("status", "published")
          .maybeSingle(),
      ]);
      if (bookingError || surveyError) throw bookingError || surveyError;
      if (!booking) return json({ error: "booking_not_found" }, 404);
      if (!survey) return json({ error: "survey_unavailable" }, 409);
      if (/cancel|failed|refund/i.test(String(booking.status || "")))
        return json({ error: "booking_not_eligible" }, 409);
      const baseUrl = safeBaseUrl(body.base_url);
      if (!baseUrl) return json({ error: "invalid_base_url" }, 400);
      const invitation = await createInvitation(
        admin,
        survey,
        booking,
        user.id,
      );
      const firstName = String(booking.receiver_name || "Customer")
        .trim()
        .split(/\s+/)[0]
        .slice(0, 50);
      const source =
        body.action === "send_invite_sms"
          ? "sms"
          : body.action === "send_invite_email"
            ? "email"
            : "web";
      const link = `${baseUrl}/feedback/${survey.slug}?token=${encodeURIComponent(invitation.token)}&source=${source}`;
      const accountEmail = await getAccountEmail(admin, booking.user_id);
      const common = {
        token: invitation.token,
        url: link,
        expires_at: invitation.expiresAt,
        customer: {
          first_name: firstName,
          order_reference: booking.id.slice(-8).toUpperCase(),
          masked_phone: phoneMask(booking.receiver_phone),
          masked_email: accountEmail ? emailMask(accountEmail) : null,
        },
      };
      if (body.action === "send_invite_sms") {
        const sms = await sendFeedbackSms(
          admin,
          survey,
          booking,
          invitation.id,
          link,
          user.id,
        );
        return json({ success: sms.ok, ...common, sms }, sms.ok ? 201 : 502);
      }
      if (body.action === "send_invite_email") {
        const email = await sendFeedbackEmail(
          admin,
          survey,
          booking,
          invitation.id,
          link,
          user.id,
        );
        return json(
          { success: email.ok, ...common, email },
          email.ok ? 201 : 502,
        );
      }
      return json({ success: true, ...common }, 201);
    }

    const token = String(body.token || "").trim();
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token))
      return json({ available: false, error: "invalid_link" }, 404);
    const { data: invitation, error: inviteError } = await admin
      .from("feedback_invitations")
      .select("id,survey_id,booking_id,expires_at,used_at,revoked_at")
      .eq("token_hash", await digest(token))
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (
      !invitation ||
      invitation.revoked_at ||
      invitation.used_at ||
      new Date(invitation.expires_at) <= new Date()
    )
      return json({ available: false, error: "link_unavailable" }, 410);
    const [
      { data: survey, error: surveyError },
      { data: booking, error: bookingError },
    ] = await Promise.all([
      admin
        .from("feedback_surveys")
        .select(
          "id,slug,form_type,title,description,status,estimated_minutes,sms_template,questions,version",
        )
        .eq("id", invitation.survey_id)
        .eq("status", "published")
        .maybeSingle(),
      admin
        .from("bookings")
        .select("id,receiver_name")
        .eq("id", invitation.booking_id)
        .maybeSingle(),
    ]);
    if (surveyError || bookingError) throw surveyError || bookingError;
    if (!survey || !booking)
      return json({ available: false, error: "link_unavailable" }, 410);
    const questions = validateQuestions(survey.questions);
    const context = {
      first_name: String(booking.receiver_name || "Customer")
        .trim()
        .split(/\s+/)[0]
        .slice(0, 50),
      order_reference: booking.id.slice(-8).toUpperCase(),
      expires_at: invitation.expires_at,
    };
    if (body.action === "status")
      return json({
        available: true,
        survey: { ...survey, questions },
        customer: context,
      });
    if (String(body.company || "").length > 0) return json({ success: true });
    const answers = cleanAnswers(body.answers, questions);
    const elapsed = Number(body.client_elapsed_ms);
    if (!Number.isFinite(elapsed) || elapsed < 2500 || elapsed > 86_400_000)
      return json({ error: "invalid_submission_timing" }, 400);
    const ip = (
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown"
    )
      .split(",")[0]
      .trim();
    const fingerprint = await digest(
      `${ip}|${(req.headers.get("user-agent") || "unknown").slice(0, 300)}|${survey.slug}|${serviceKey.slice(-16)}`,
    );
    const { count, error: countError } = await admin
      .from("feedback_responses")
      .select("id", { count: "exact", head: true })
      .eq("submission_fingerprint", fingerprint)
      .gte("submitted_at", new Date(Date.now() - 60 * 60_000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= 5) return json({ error: "rate_limited" }, 429);
    const source = ["web", "sms", "email", "whatsapp"].includes(
      String(body.source),
    )
      ? String(body.source)
      : "web";
    const { data: responseId, error: responseError } = await admin.rpc(
      "submit_feedback_response",
      {
        p_invitation_id: invitation.id,
        p_answers: answers,
        p_nps_score:
          answers.nps_score == null ? null : Number(answers.nps_score),
        p_overall_rating:
          answers.overall_rating == null
            ? null
            : Number(answers.overall_rating),
        p_source: source,
        p_submission_fingerprint: fingerprint,
        p_client_elapsed_ms: Math.round(elapsed),
      },
    );
    if (responseError) throw responseError;
    return json({ success: true, response_id: responseId }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[feedback-survey]", message);
    if (/^(invalid_|missing_|answers_)/.test(message))
      return json({ error: message }, 400);
    if (message.includes("feedback_invitation_unavailable"))
      return json({ error: "link_unavailable" }, 410);
    return json({ error: "request_failed" }, 500);
  }
});

function phoneMask(phone: unknown) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `••••••${digits.slice(-4)}` : "—";
}
