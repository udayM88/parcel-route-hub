// Business API key management. Only a SHA-256 hash of each key is stored;
// the full key is returned exactly once, at creation.
// Actions: create { name, environment: "live"|"sandbox" }, revoke { id }.
// Admins (super_admin/operations) may revoke any key with { id }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MAX_ACTIVE_KEYS = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await authClient.auth.getUser();
    if (!u?.user) return json({ error: "Invalid session" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    const { data: biz } = await admin.from("business_accounts").select("id,status")
      .eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    const { data: au } = await admin.from("admin_users").select("role")
      .eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    const isStaff = !!au && ["super_admin", "operations"].includes(au.role);

    if (body.action === "revoke") {
      if (!body.id) return json({ error: "id required" }, 400);
      let q = admin.from("business_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", body.id).is("revoked_at", null);
      if (!isStaff) {
        if (!biz) return json({ error: "Forbidden" }, 403);
        q = q.eq("business_account_id", biz.id);
      }
      const { data, error } = await q.select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data?.length) return json({ error: "Key not found or already revoked" }, 404);
      return json({ success: true });
    }

    if (body.action === "create") {
      if (!biz || biz.status !== "approved") return json({ error: "Business account not approved" }, 403);
      const name = String(body.name || "").trim().slice(0, 60);
      const environment = body.environment === "sandbox" ? "sandbox" : "live";
      if (name.length < 2) return json({ error: "Give the key a name" }, 400);
      const { count } = await admin.from("business_api_keys").select("id", { count: "exact", head: true })
        .eq("business_account_id", biz.id).is("revoked_at", null);
      if ((count ?? 0) >= MAX_ACTIVE_KEYS) return json({ error: `Maximum ${MAX_ACTIVE_KEYS} active keys` }, 400);

      const rand = new Uint8Array(24);
      crypto.getRandomValues(rand);
      const secret = Array.from(rand).map((b) => b.toString(16).padStart(2, "0")).join("");
      const key = `vs_${environment === "live" ? "live" : "test"}_${secret}`;
      const { data, error } = await admin.from("business_api_keys").insert({
        business_account_id: biz.id, name, environment,
        key_prefix: key.slice(0, 12), key_hash: await sha256Hex(key), created_by: u.user.id,
      }).select("id,name,key_prefix,environment,created_at").single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, key, record: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
