import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["super_admin", "cms_editor", "operations", "support"] as const;
type Role = typeof ALLOWED_ROLES[number];

const resetPathByRole: Record<Role, string> = {
  super_admin: "/admin/reset-password",
  cms_editor: "/cms/reset-password",
  operations: "/ops/reset-password",
  support: "/ops/reset-password",
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

    const { data: caller } = await supabaseAdmin
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!caller || caller.role !== "super_admin") {
      throw new Error("Only super admins can reset admin passwords");
    }

    const { admin_user_id } = (await req.json()) ?? {};
    if (!admin_user_id || typeof admin_user_id !== "string") {
      throw new Error("admin_user_id is required");
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, role, is_active")
      .eq("id", admin_user_id)
      .maybeSingle();

    if (targetError) throw new Error(targetError.message);
    if (!target) throw new Error("Admin user not found");
    if (!target.is_active) throw new Error("Cannot reset password for an inactive admin user");
    if (!ALLOWED_ROLES.includes(target.role as Role)) {
      throw new Error("Invalid admin role");
    }

    const origin = req.headers.get("origin") ?? "";
    const isLiveOrigin = /^https:\/\/([a-z0-9-]+\.)*viasetu\.com$/.test(origin);
    const siteUrl = isLiveOrigin ? origin : "https://www.viasetu.com";
    const redirectPath = resetPathByRole[target.role as Role] ?? "/admin/reset-password";
    const redirectTo = `${siteUrl}${redirectPath}`;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { error } = await withTimeout(
        supabaseAdmin.auth.resetPasswordForEmail(target.email, { redirectTo }),
        15000,
        "Supabase recovery email",
      );
      if (error) throw error;
      emailSent = true;
    } catch (err) {
      emailError = (err as Error).message;
      console.error("Admin password reset email failed:", emailError);
    }

    let setupLink: string | null = null;
    if (!emailSent) {
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: target.email,
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
        email: target.email,
        email_sent: emailSent,
        email_error: emailError,
        setup_link: setupLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("reset-admin-password error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
