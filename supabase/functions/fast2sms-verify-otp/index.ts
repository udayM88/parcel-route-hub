import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Play review test account: fixed OTP, no SMS/DB record involved.
const TEST_PHONE = "8830306901";
const TEST_OTP = "12345";

const MAX_ATTEMPTS = 5;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "phone must be a 10-digit string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!otp || !/^\d{5}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "otp must be 5 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phoneE164 = `+91${phone}`;

    // Isolated test-number short-circuit (Google Play review).
    if (phone === TEST_PHONE) {
      if (otp === TEST_OTP) {
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Incorrect OTP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Latest unverified, unexpired OTP for this phone
    const { data: row, error: selErr } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("phone", phoneE164)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selErr) throw selErr;
    if (!row) {
      return new Response(
        JSON.stringify({ error: "OTP expired or not found. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      // Invalidate so user must request a fresh OTP
      await supabase.from("otp_verifications").update({ verified: true }).eq("id", row.id);
      return new Response(
        JSON.stringify({ error: "Too many wrong attempts. Please request a new OTP." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const expectedHash = await sha256Hex(`${phoneE164}:${otp}`);

    if (expectedHash !== row.otp_hash) {
      const newAttempts = (row.attempts ?? 0) + 1;
      await supabase
        .from("otp_verifications")
        .update({ attempts: newAttempts })
        .eq("id", row.id);
      const remaining = MAX_ATTEMPTS - newAttempts;
      return new Response(
        JSON.stringify({
          error: remaining > 0
            ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
            : "Incorrect OTP. Please request a new one.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark verified
    await supabase
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", row.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("fast2sms-verify-otp error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
