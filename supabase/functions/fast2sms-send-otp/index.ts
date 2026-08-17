import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Play review test account: no SMS is sent, fixed OTP is accepted.
const TEST_PHONE = "8830306901";

const RESEND_COOLDOWN_SECONDS = 30;
const MAX_PER_HOUR = 5;
const OTP_TTL_MINUTES = 5;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOtp(): string {
  // 5-digit numeric, leading zeros allowed via padStart
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  return n.toString().padStart(5, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string" || !/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "phone must be a 10-digit string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phoneE164 = `+91${phone}`;

    // Isolated test-number short-circuit (Google Play review).
    if (phone === TEST_PHONE) {
      return new Response(
        JSON.stringify({ success: true, expires_in: OTP_TTL_MINUTES * 60 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("FAST2SMS_API_KEY");
    const senderId = Deno.env.get("FAST2SMS_SENDER_ID");
    const messageId = Deno.env.get("FAST2SMS_MESSAGE_ID");
    const entityId = Deno.env.get("FAST2SMS_ENTITY_ID");
    if (!apiKey || !senderId || !messageId || !entityId) {
      console.error("Fast2SMS env not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate-limit: resend cooldown + hourly cap
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("otp_verifications")
      .select("created_at")
      .eq("phone", phoneE164)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false });

    if (recent && recent.length > 0) {
      const lastMs = new Date(recent[0].created_at as string).getTime();
      const sinceLast = (Date.now() - lastMs) / 1000;
      if (sinceLast < RESEND_COOLDOWN_SECONDS) {
        return new Response(
          JSON.stringify({
            error: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - sinceLast)}s before requesting another OTP.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (recent.length >= MAX_PER_HOUR) {
        return new Response(
          JSON.stringify({ error: "Too many OTP requests. Please try again in an hour." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const otp = generateOtp();
    const otpHash = await sha256Hex(`${phoneE164}:${otp}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // Send via Fast2SMS DLT route
    const params = new URLSearchParams({
      authorization: apiKey,
      route: "dlt",
      sender_id: senderId,
      message: messageId,
      variables_values: otp,
      flash: "0",
      numbers: phone,
      entity_id: entityId,
    });

    const smsResp = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`, {
      method: "GET",
    });
    const smsBody = await smsResp.json().catch(() => ({}));

    if (!smsResp.ok || smsBody?.return !== true) {
      console.error("Fast2SMS error", smsResp.status, JSON.stringify(smsBody));
      const raw = `${smsBody?.message ?? ""} ${smsBody?.status_code ?? ""}`.toLowerCase();
      const insufficientBalance =
        raw.includes("insufficient") || raw.includes("balance") || smsBody?.status_code === 402;
      return new Response(
        JSON.stringify({
          error: insufficientBalance
            ? "SMS service temporarily unavailable. Please try again shortly or contact support."
            : (typeof smsBody?.message === "string" ? smsBody.message : "Failed to send OTP"),
          code: insufficientBalance ? "SMS_BALANCE_EXHAUSTED" : "SMS_SEND_FAILED",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // Persist hash AFTER successful send
    const { error: insErr } = await supabase.from("otp_verifications").insert({
      phone: phoneE164,
      otp_hash: otpHash,
      expires_at: expiresAt,
      verified: false,
      attempts: 0,
    });
    if (insErr) {
      console.error("OTP insert error", insErr);
      return new Response(
        JSON.stringify({ error: "Failed to record OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, expires_in: OTP_TTL_MINUTES * 60 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("fast2sms-send-otp error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
