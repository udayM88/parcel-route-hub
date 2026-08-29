import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string) =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);

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
      throw new Error("Only super admins or operations can reset business passwords");
    }

    const { business_id } = (await req.json()) ?? {};
    if (!business_id || typeof business_id !== "string") throw new Error("business_id is required");

    const { data: business, error: bizError } = await supabaseAdmin
      .from("business_accounts")
      .select("id,email,company_name,deleted_at,is_active")
      .eq("id", business_id)
      .maybeSingle();

    if (bizError) throw new Error(bizError.message);
    if (!business) throw new Error("Business account not found");
    if (business.deleted_at) throw new Error("This business account is deleted; restore it before resetting the password");

    const origin = req.headers.get("origin") ?? "";
    const isLiveOrigin = /^https:\/\/([a-z0-9-]+\.)*viasetu\.com$/.test(origin);
    const siteUrl = isLiveOrigin ? origin : "https://www.viasetu.com";
    const redirectTo = `${siteUrl}/viasetuforbusinesses/reset-password`;

    // Preferred path: let Supabase send its own recovery email (same mechanism
    // as the built-in "Reset password" flow, template editable in the dashboard).
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { error } = await withTimeout(
        supabaseAdmin.auth.resetPasswordForEmail(business.email, { redirectTo }),
        15000,
        "Supabase recovery email",
      );
      if (error) throw error;
      emailSent = true;
    } catch (err) {
      emailError = (err as Error).message;
      console.error("Business password reset email failed:", emailError);
    }

    // Only generate a manual link when the email failed — generating one
    // otherwise would overwrite the token in the email just sent.
    let setupLink: string | null = null;
    if (!emailSent) {
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: business.email,
          options: { redirectTo },
        });
        if (linkError) throw linkError;
        setupLink = linkData?.properties?.action_link ?? null;
      } catch (err) {
        console.error("generateLink failed:", (err as Error).message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: business.email,
        email_sent: emailSent,
        email_error: emailError,
        setup_link: setupLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("reset-business-password error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
