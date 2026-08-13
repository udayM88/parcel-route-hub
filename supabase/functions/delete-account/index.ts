import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Play review test account (same isolated bypass as the OTP flow).
const TEST_PHONE = "8830306901";
const TEST_OTP = "12345";

const MAX_ATTEMPTS = 5;
const VIASETU_PHONE_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const hexToBytes = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
};

async function deriveUserId(phoneDigits: string): Promise<string> {
  const namespaceBytes = hexToBytes(VIASETU_PHONE_NAMESPACE.replace(/-/g, ""));
  const nameBytes = new TextEncoder().encode(`+91${phoneDigits}`);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);
  const hashBuffer = await crypto.subtle.digest("SHA-1", combined);
  const b = new Uint8Array(hashBuffer).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, otp } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return json({ error: "phone must be a 10-digit string" }, 400);
    }
    if (!otp || !/^\d{5}$/.test(otp)) {
      return json({ error: "otp must be 5 digits" }, 400);
    }

    const phoneE164 = `+91${phone}`;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Verify OTP ownership of the number ---
    if (phone === TEST_PHONE) {
      if (otp !== TEST_OTP) return json({ error: "Incorrect OTP." }, 400);
    } else {
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
      if (!row) return json({ error: "OTP expired or not found. Please request a new one." }, 400);

      if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
        await supabase.from("otp_verifications").update({ verified: true }).eq("id", row.id);
        return json({ error: "Too many wrong attempts. Please request a new OTP." }, 429);
      }

      const expectedHash = await sha256Hex(`${phoneE164}:${otp}`);
      if (expectedHash !== row.otp_hash) {
        await supabase
          .from("otp_verifications")
          .update({ attempts: (row.attempts ?? 0) + 1 })
          .eq("id", row.id);
        return json({ error: "Incorrect OTP." }, 400);
      }

      await supabase.from("otp_verifications").update({ verified: true }).eq("id", row.id);
    }

    const userId = await deriveUserId(phone);

    // --- Block deletion while shipments are still moving ---
    const ACTIVE_STATUSES = [
      "CREATED",
      "PAYMENT_RECEIVED",
      "CONFIRMED",
      "PICKUP_SCHEDULED",
      "PICKED_UP",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "BALANCE_DUE",
    ];
    const { data: active } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ACTIVE_STATUSES)
      .limit(1);

    if (active && active.length > 0) {
      return json({
        error:
          "You have shipments that are still in progress. Please wait until they are delivered or cancelled, or contact support, before deleting your account.",
      }, 409);
    }

    // --- Anonymise past bookings (financial records must be retained by law) ---
    const { data: pastBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", userId);

    if (pastBookings && pastBookings.length > 0) {
      await supabase
        .from("bookings")
        .update({
          sender_name: "Deleted user",
          sender_phone: "0000000000",
          sender_address: "Redacted on account deletion",
          receiver_name: "Deleted user",
          receiver_phone: "0000000000",
          receiver_address: "Redacted on account deletion",
        })
        .eq("user_id", userId);
    }

    // --- Delete personal data ---
    await supabase.from("saved_addresses").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("user_id", userId);
    await supabase.from("otp_verifications").delete().eq("phone", phoneE164);

    return json({
      success: true,
      anonymised_orders: pastBookings?.length ?? 0,
    });
  } catch (err) {
    console.error("delete-account error", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
