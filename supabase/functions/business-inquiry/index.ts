// Public endpoint: stores a business inquiry and notifies the admin inbox.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchEmail } from "../_shared/notify-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-prayog-auth, x-environment",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VOLUMES = ["1-50", "51-200", "201-500", "501-1,000", "1,001-5,000", "5,000+"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const company_name = String(body.company_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const business_type = String(body.business_type || "").trim();
    const monthly_volume = String(body.monthly_volume || "").trim();

    const errors: Record<string, string> = {};
    if (name.length < 2 || name.length > 100) errors.name = "Enter your full name";
    if (company_name.length < 2 || company_name.length > 150) errors.company_name = "Enter your business name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255) errors.email = "Enter a valid email";
    if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Enter a valid 10-digit mobile number";
    if (business_type.length < 2 || business_type.length > 100) errors.business_type = "Select a business type";
    if (!VOLUMES.includes(monthly_volume)) errors.monthly_volume = "Select monthly shipment volume";

    if (Object.keys(errors).length) return json({ error: "validation_failed", fields: errors }, 400);

    // Duplicate protection: same email or phone within the last 24 hours.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: dupes } = await supabase
      .from("business_inquiries")
      .select("id")
      .gte("created_at", since)
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1);

    if (dupes && dupes.length) {
      return json({ duplicate: true, message: "We already have your inquiry — our team will reach out shortly." }, 200);
    }

    const { data: row, error } = await supabase
      .from("business_inquiries")
      .insert({ name, company_name, email, phone, business_type, monthly_volume })
      .select("id")
      .single();

    if (error) throw error;

    dispatchEmail("business_inquiry", null, {
      name,
      company_name,
      email,
      phone,
      business_type,
      monthly_volume,
      submitted_at: new Date().toLocaleString("en-IN"),
    });

    return json({ success: true, id: row.id });
  } catch (e) {
    console.error("[business-inquiry] error", String(e));
    return json({ error: "Could not submit your inquiry. Please try again." }, 500);
  }
});
