import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { data: adminUser } = await supabaseAdmin
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!adminUser || !["super_admin", "operations"].includes(adminUser.role)) {
      throw new Error("Only super admins or operations can create business users");
    }

    const body = await req.json();
    const {
      company_name,
      contact_person,
      email,
      phone,
      pan_number,
      gst_number,
      shop_act_number,
      monthly_shipments,
      address,
      city,
      state,
      pincode,
      documents,
      notes,
    } = body ?? {};

    if (!company_name || typeof company_name !== "string") throw new Error("Company name is required");
    if (!contact_person || typeof contact_person !== "string") throw new Error("Contact person is required");
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("A valid email is required");
    }
    if (!phone || !/^\d{10}$/.test(String(phone).trim())) throw new Error("Phone must be 10 digits");
    if (!pan_number || typeof pan_number !== "string") throw new Error("PAN is required");
    const volume = Number(monthly_shipments);
    if (!Number.isFinite(volume) || volume < 0) throw new Error("Monthly shipments must be a number");

    const cleanEmail = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("business_accounts")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();
    if (existing) throw new Error("A business account with this email already exists");

    const tempPassword = crypto.randomUUID() + "A1@";
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
    });
    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`);
    if (!authData.user) throw new Error("Failed to create user");

    const { error: insertError } = await supabaseAdmin.from("business_accounts").insert({
      user_id: authData.user.id,
      company_name: company_name.trim(),
      contact_person: contact_person.trim(),
      email: cleanEmail,
      phone: String(phone).trim(),
      pan_number: pan_number.trim().toUpperCase(),
      gst_number: gst_number ? String(gst_number).trim().toUpperCase() : null,
      shop_act_number: shop_act_number ? String(shop_act_number).trim() : null,
      monthly_shipments: Math.round(volume),
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      pincode: pincode ?? null,
      documents: Array.isArray(documents) ? documents : [],
      status: "approved",
      is_active: true,
      notes: notes ?? null,
      created_by: user.id,
      approved_at: new Date().toISOString(),
    });

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create business account: ${insertError.message}`);
    }

    // Always send business users to the live site, never a preview/sandbox origin
    const origin = req.headers.get("origin") ?? "";
    const isLiveOrigin = /^https:\/\/([a-z0-9-]+\.)*viasetu\.com$/.test(origin);
    const siteUrl = isLiveOrigin ? origin : "https://www.viasetu.com";

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/viasetuforbusinesses/reset-password`,
    });
    if (resetError) console.error("Failed to send password reset email:", resetError);

    return new Response(
      JSON.stringify({ success: true, message: "Business user created successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("create-business-user error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
