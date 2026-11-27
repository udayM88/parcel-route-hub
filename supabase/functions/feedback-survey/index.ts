import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validTypes = new Set(["nps", "stars", "single", "multi", "text"]);
const validSections = new Set(["overall", "order", "comparison", "future"]);

type Question = { id: string; title: string; helper?: string; section: string; type: string; options?: string[]; required?: boolean; maxLength?: number; otherAnswerKey?: string };

const digest = async (value: string) => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const tenDigit = (phone: unknown) => {
  const value = String(phone ?? "").replace(/\D/g, "").slice(-10);
  return /^\d{10}$/.test(value) ? value : null;
};

function validateQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) throw new Error("invalid_questions");
  const ids = new Set<string>();
  return raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("invalid_question");
    const input = item as Record<string, unknown>;
    const id = String(input.id || "").trim();
    const title = String(input.title || "").trim();
    const type = String(input.type || "");
    const section = String(input.section || "order");
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(id) || ids.has(id)) throw new Error("invalid_question_id");
    if (!title || title.length > 240 || !validTypes.has(type) || !validSections.has(section)) throw new Error("invalid_question");
    ids.add(id);
    const question: Question = { id, title, type, section, required: Boolean(input.required) };
    if (typeof input.helper === "string" && input.helper.trim()) question.helper = input.helper.trim().slice(0, 300);
    if (type === "single" || type === "multi") {
      if (!Array.isArray(input.options)) throw new Error("invalid_question_options");
      const options = [...new Set(input.options.map((option) => String(option).trim()).filter(Boolean))].slice(0, 25);
      if (options.length < 2 || options.some((option) => option.length > 120)) throw new Error("invalid_question_options");
      question.options = options;
      if (options.includes("Other")) question.otherAnswerKey = `${id}_other`;
    }
    if (type === "text") question.maxLength = Math.min(Math.max(Number(input.maxLength) || 1000, 100), 2000);
    return question;
  });
}

function cleanAnswers(raw: unknown, questions: Question[]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid_answers");
  const source = raw as Record<string, unknown>;
  const answers: Record<string, string | number | string[]> = {};
  for (const question of questions) {
    const value = source[question.id];
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      if (question.required) throw new Error(`missing_${question.id}`);
      continue;
    }
    if (question.type === "nps" || question.type === "stars") {
      if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`invalid_${question.id}`);
      if ((question.type === "nps" && (value < 0 || value > 10)) || (question.type === "stars" && (value < 1 || value > 5))) throw new Error(`invalid_${question.id}`);
      answers[question.id] = value;
    } else if (question.type === "single") {
      if (typeof value !== "string" || !question.options?.includes(value)) throw new Error(`invalid_${question.id}`);
      answers[question.id] = value;
    } else if (question.type === "multi") {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !question.options?.includes(entry))) throw new Error(`invalid_${question.id}`);
      answers[question.id] = [...new Set(value as string[])].slice(0, 25);
    } else {
      if (typeof value !== "string") throw new Error(`invalid_${question.id}`);
      answers[question.id] = value.trim().slice(0, question.maxLength || 1000);
    }
    const hasOther = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).includes("Other") : answers[question.id] === "Other";
    if (hasOther && question.otherAnswerKey) {
      const other = source[question.otherAnswerKey];
      if (typeof other !== "string" || !other.trim()) throw new Error(`missing_${question.otherAnswerKey}`);
      answers[question.otherAnswerKey] = other.trim().slice(0, 300);
    }
  }
  if (JSON.stringify(answers).length > 30_000) throw new Error("answers_too_large");
  return answers;
}

async function requireSuperAdmin(req: Request, adminClient: any) {
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return null;
  const { data, error } = await adminClient.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: admin } = await adminClient.from("admin_users").select("role,is_active").eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
  return admin?.role === "super_admin" ? data.user : null;
}

async function createInvitation(admin: any, survey: any, booking: any, createdBy: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("feedback_invitations").update({ revoked_at: now.toISOString() }).eq("survey_id", survey.id).eq("booking_id", booking.id).is("used_at", null).is("revoked_at", null);
  const token = randomToken();
  const { data, error } = await admin.from("feedback_invitations").insert({ survey_id: survey.id, booking_id: booking.id, user_id: booking.user_id, token_hash: await digest(token), expires_at: expiresAt, created_by: createdBy }).select("id,expires_at").single();
  if (error) throw error;
  return { token, id: data.id, expiresAt: data.expires_at };
}

async function sendFeedbackSms(admin: any, survey: any, booking: any, invitationId: string, link: string) {
  const apiKey = Deno.env.get("FAST2SMS_API_KEY");
  const senderId = Deno.env.get("FAST2SMS_SENDER_ID");
  const entityId = Deno.env.get("FAST2SMS_ENTITY_ID");
  const phone = tenDigit(booking.receiver_phone);
  if (!survey.dlt_template_id) return { ok: false, reason: "Approved DLT template ID is not configured", retryable: false };
  if (!apiKey || !senderId || !entityId) return { ok: false, reason: "Fast2SMS is not configured", retryable: false };
  if (!phone) return { ok: false, reason: "Customer phone number is invalid", retryable: false };

  const dedupeKey = `FEEDBACK_SURVEY|${invitationId}`;
  const { data: claim, error: claimError } = await admin.from("sms_logs").insert({ event_key: "FEEDBACK_SURVEY", booking_id: booking.id, dedupe_key: dedupeKey, template_id: survey.dlt_template_id, to_phone: phone, variables: [link], message_preview: survey.sms_template.replace("{#var#}", link), status: "sending", attempt_count: 0 }).select("id").single();
  if (claimError) return { ok: claimError.code === "23505", reason: claimError.code === "23505" ? null : "Could not create SMS audit log", retryable: false };
  const params = new URLSearchParams({ authorization: apiKey, route: "dlt", sender_id: senderId, message: survey.dlt_template_id, variables_values: link.replace(/\|/g, "%7C"), flash: "0", numbers: phone, entity_id: entityId });
  try {
    const response = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`, { method: "GET" });
    const payload = await response.json().catch(() => ({}));
    const ok = response.ok && payload?.return === true;
    const reason = ok ? null : (payload?.message ? JSON.stringify(payload.message) : `HTTP ${response.status}`);
    const retryable = !ok && (response.status >= 500 || response.status === 429);
    await admin.from("sms_logs").update({ status: ok ? "sent" : "failed", reason, provider_response: payload, attempt_count: 1, sent_at: ok ? new Date().toISOString() : null, next_retry_at: retryable ? new Date(Date.now() + 5 * 60_000).toISOString() : null }).eq("id", claim.id);
    return { ok, reason, retryable, logId: claim.id };
  } catch (error) {
    const reason = `Network error: ${String(error)}`;
    await admin.from("sms_logs").update({ status: "failed", reason, attempt_count: 1, next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq("id", claim.id);
    return { ok: false, reason, retryable: true, logId: claim.id };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "service_unavailable" }, 503);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    if (["create_invite", "send_invite_sms", "save_survey", "update_survey"].includes(body.action)) {
      const user = await requireSuperAdmin(req, admin);
      if (!user) return json({ error: "not_authorized" }, 403);

      if (body.action === "save_survey" || body.action === "update_survey") {
        const questions = validateQuestions(body.survey?.questions);
        const title = String(body.survey?.title || "").trim().slice(0, 120);
        const description = String(body.survey?.description || "").trim().slice(0, 500);
        const smsTemplate = String(body.survey?.sms_template || "").trim().slice(0, 500);
        const dltTemplateId = String(body.survey?.dlt_template_id || "").trim().slice(0, 100) || null;
        if (!title || !smsTemplate.includes("{#var#}")) return json({ error: "invalid_survey" }, 400);
        const row = { title, description, status: ["draft", "published", "paused"].includes(body.survey?.status) ? body.survey.status : "draft", estimated_minutes: Math.min(Math.max(Number(body.survey?.estimated_minutes) || 3, 1), 30), question_count: questions.length, questions, sms_template: smsTemplate, dlt_template_id: dltTemplateId, updated_at: new Date().toISOString() };
        if (body.action === "update_survey") {
          const id = String(body.survey?.id || "");
          if (!uuid.test(id)) return json({ error: "invalid_survey_id" }, 400);
          const { data, error } = await admin.from("feedback_surveys").update(row).eq("id", id).select("*").single();
          if (error) throw error;
          return json({ success: true, survey: data });
        }
        const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45) || "custom-form";
        const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
        const { data, error } = await admin.from("feedback_surveys").insert({ ...row, slug, form_type: "custom", version: 1, created_by: user.id }).select("*").single();
        if (error) throw error;
        return json({ success: true, survey: data }, 201);
      }

      const bookingId = String(body.booking_id || "").trim();
      const surveyId = String(body.survey_id || "").trim();
      if (!uuid.test(bookingId) || !uuid.test(surveyId)) return json({ error: "invalid_request" }, 400);
      const [{ data: booking, error: bookingError }, { data: survey, error: surveyError }] = await Promise.all([
        admin.from("bookings").select("id,user_id,receiver_name,receiver_phone,status,payment_status").eq("id", bookingId).maybeSingle(),
        admin.from("feedback_surveys").select("*").eq("id", surveyId).eq("status", "published").maybeSingle(),
      ]);
      if (bookingError || surveyError) throw bookingError || surveyError;
      if (!booking) return json({ error: "booking_not_found" }, 404);
      if (!survey) return json({ error: "survey_unavailable" }, 409);
      if (/cancel|failed|refund/i.test(String(booking.status || ""))) return json({ error: "booking_not_eligible" }, 409);
      const invitation = await createInvitation(admin, survey, booking, user.id);
      const firstName = String(booking.receiver_name || "Customer").trim().split(/\s+/)[0].slice(0, 50);
      const baseUrl = String(body.base_url || "").replace(/\/$/, "");
      const link = `${baseUrl}/feedback/${survey.slug}?token=${encodeURIComponent(invitation.token)}&source=sms`;
      const common = { token: invitation.token, url: link, expires_at: invitation.expiresAt, customer: { first_name: firstName, order_reference: booking.id.slice(-8).toUpperCase(), masked_phone: phoneMask(booking.receiver_phone) } };
      if (body.action === "send_invite_sms") {
        let parsed: URL;
        try { parsed = new URL(baseUrl); } catch { return json({ error: "invalid_base_url" }, 400); }
        if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return json({ error: "invalid_base_url" }, 400);
        const sms = await sendFeedbackSms(admin, survey, booking, invitation.id, link);
        return json({ success: sms.ok, ...common, sms }, sms.ok ? 201 : 502);
      }
      return json({ success: true, ...common }, 201);
    }

    const token = String(body.token || "").trim();
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return json({ available: false, error: "invalid_link" }, 404);
    const { data: invitation, error: inviteError } = await admin.from("feedback_invitations").select("id,survey_id,booking_id,expires_at,used_at,revoked_at").eq("token_hash", await digest(token)).maybeSingle();
    if (inviteError) throw inviteError;
    if (!invitation || invitation.revoked_at || invitation.used_at || new Date(invitation.expires_at) <= new Date()) return json({ available: false, error: "link_unavailable" }, 410);
    const [{ data: survey, error: surveyError }, { data: booking, error: bookingError }] = await Promise.all([
      admin.from("feedback_surveys").select("id,slug,form_type,title,description,status,estimated_minutes,sms_template,questions,version").eq("id", invitation.survey_id).eq("status", "published").maybeSingle(),
      admin.from("bookings").select("id,receiver_name").eq("id", invitation.booking_id).maybeSingle(),
    ]);
    if (surveyError || bookingError) throw surveyError || bookingError;
    if (!survey || !booking) return json({ available: false, error: "link_unavailable" }, 410);
    const questions = validateQuestions(survey.questions);
    const context = { first_name: String(booking.receiver_name || "Customer").trim().split(/\s+/)[0].slice(0, 50), order_reference: booking.id.slice(-8).toUpperCase(), expires_at: invitation.expires_at };
    if (body.action === "status") return json({ available: true, survey: { ...survey, questions }, customer: context });
    if (String(body.company || "").length > 0) return json({ success: true });
    const answers = cleanAnswers(body.answers, questions);
    const elapsed = Number(body.client_elapsed_ms);
    if (!Number.isFinite(elapsed) || elapsed < 2500 || elapsed > 86_400_000) return json({ error: "invalid_submission_timing" }, 400);
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
    const fingerprint = await digest(`${ip}|${(req.headers.get("user-agent") || "unknown").slice(0, 300)}|${survey.slug}|${serviceKey.slice(-16)}`);
    const { count, error: countError } = await admin.from("feedback_responses").select("id", { count: "exact", head: true }).eq("submission_fingerprint", fingerprint).gte("submitted_at", new Date(Date.now() - 60 * 60_000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= 5) return json({ error: "rate_limited" }, 429);
    const source = ["web", "sms", "email", "whatsapp"].includes(String(body.source)) ? String(body.source) : "web";
    const { data: responseId, error: responseError } = await admin.rpc("submit_feedback_response", { p_invitation_id: invitation.id, p_answers: answers, p_nps_score: answers.nps_score == null ? null : Number(answers.nps_score), p_overall_rating: answers.overall_rating == null ? null : Number(answers.overall_rating), p_source: source, p_submission_fingerprint: fingerprint, p_client_elapsed_ms: Math.round(elapsed) });
    if (responseError) throw responseError;
    return json({ success: true, response_id: responseId }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[feedback-survey]", message);
    if (/^(invalid_|missing_|answers_)/.test(message)) return json({ error: message }, 400);
    if (message.includes("feedback_invitation_unavailable")) return json({ error: "link_unavailable" }, 410);
    return json({ error: "request_failed" }, 500);
  }
});

function phoneMask(phone: unknown) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `••••••${digits.slice(-4)}` : "—";
}
