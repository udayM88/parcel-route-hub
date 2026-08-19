import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_REASONS = [
  "duplicate_account",
  "business_closed",
  "fraud_or_misuse",
  "kyc_invalid",
  "requested_by_business",
  "non_payment",
  "other",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: adminUser } = await supabaseAdmin
      .from("admin_users")
      .select("role,email")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser || !["super_admin", "operations"].includes(adminUser.role)) {
      return json({ error: "Only super admins or operations can delete business accounts" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { business_id, reason, note } = body ?? {};

    if (!business_id || typeof business_id !== "string") {
      return json({ error: "business_id is required" }, 400);
    }
    if (!reason || !ALLOWED_REASONS.includes(reason)) {
      return json({ error: "A valid deletion reason is required" }, 400);
    }
    if (reason === "other" && (!note || String(note).trim().length < 3)) {
      return json({ error: "A note is required when the reason is 'Other'" }, 400);
    }

    const { data: account, error: fetchErr } = await supabaseAdmin
      .from("business_accounts")
      .select("id,user_id,company_name,deleted_at")
      .eq("id", business_id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!account) return json({ error: "Business account not found" }, 404);
    if (account.deleted_at) return json({ error: "This account is already deleted" }, 409);

    // Revoke login immediately: ban the auth user, then unlink it from the account.
    if (account.user_id) {
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(account.user_id, {
        ban_duration: "876000h", // ~100 years
      });
      if (banErr) console.error("[delete-business-user] ban failed", banErr.message);
    }

    const { error: updErr } = await supabaseAdmin
      .from("business_accounts")
      .update({
        user_id: null,
        is_active: false,
        status: "deleted",
        deleted_at: new Date().toISOString(),
        deletion_reason: reason,
        deletion_note: note ? String(note).slice(0, 1000) : null,
        deleted_by: user.id,
        deleted_by_email: adminUser.email ?? user.email ?? null,
      })
      .eq("id", business_id);

    if (updErr) throw updErr;

    return json({ success: true, company_name: account.company_name });
  } catch (err) {
    console.error("delete-business-user error", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
