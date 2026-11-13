import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { merchantCan, resolveMerchantAccess } from "../_shared/merchant-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const roles = new Set(["admin", "operations", "finance", "support", "developer", "viewer"]);
const statuses = new Set(["active", "suspended"]);

// deno-lint-ignore no-explicit-any
async function findAuthUserByEmail(admin: any, email: string): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const publicAuthClient = createClient(url, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(url, serviceKey);
    const access = await resolveMerchantAccess(admin, authData.user);
    if (!access) return json({ error: "Approved merchant account required" }, 403);
    if (!merchantCan(access, "team:manage")) return json({ error: "You do not have permission to manage team access" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");
    const accountId = access.business_account_id;

    if (action === "list") {
      const { data: account, error: accountError } = await admin.from("business_accounts")
        .select("user_id,contact_person,email,phone,created_at").eq("id", accountId).single();
      if (accountError) return json({ error: accountError.message }, 500);
      const { data: members, error } = await admin.from("merchant_team_members")
        .select("id,user_id,name,email,phone,role,permissions,status,invited_at,joined_at,last_active_at,created_at")
        .eq("business_account_id", accountId).order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({
        owner: {
          id: `owner:${account.user_id || accountId}`,
          user_id: account.user_id,
          name: account.contact_person,
          email: account.email,
          phone: account.phone,
          role: "owner",
          permissions: ["*"],
          status: "active",
          joined_at: account.created_at,
          is_owner: true,
        },
        members: members || [],
      });
    }

    if (action === "invite") {
      const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 100);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
      const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
      const role = String(body.role || "viewer");
      if (name.length < 2) return json({ error: "Enter the team member's full name" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid work email" }, 400);
      if (phone && phone.length !== 10) return json({ error: "Phone must contain 10 digits" }, 400);
      if (!roles.has(role)) return json({ error: "Invalid merchant role" }, 400);

      const { data: account } = await admin.from("business_accounts").select("email").eq("id", accountId).single();
      if (account?.email?.toLowerCase() === email) return json({ error: "This email already belongs to the merchant owner" }, 409);
      const { data: duplicate } = await admin.from("merchant_team_members").select("id")
        .eq("business_account_id", accountId).ilike("email", email).maybeSingle();
      if (duplicate) return json({ error: "This person is already in the merchant team" }, 409);

      const redirectTo = `${Deno.env.get("PUBLIC_SITE_URL") || "https://www.viasetu.com"}/viasetuforbusinesses/reset-password`;
      let invitedUser: User | null = null;
      let createdAuthUser = false;
      const invited = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { display_name: name, merchant_account_id: accountId, merchant_role: role },
      });
      if (invited.error) {
        invitedUser = await findAuthUserByEmail(admin, email);
        if (!invitedUser) return json({ error: invited.error.message || "Invitation could not be sent" }, 400);
      } else {
        invitedUser = invited.data.user;
        createdAuthUser = true;
      }

      const { data: ownerConflict } = await admin.from("business_accounts").select("id")
        .eq("user_id", invitedUser.id).neq("id", accountId).maybeSingle();
      const { data: teamConflict } = await admin.from("merchant_team_members").select("id,business_account_id")
        .eq("user_id", invitedUser.id).maybeSingle();
      if (ownerConflict || (teamConflict && teamConflict.business_account_id !== accountId)) {
        if (createdAuthUser) await admin.auth.admin.deleteUser(invitedUser.id);
        return json({ error: "This user already belongs to another merchant workspace" }, 409);
      }

      const now = new Date().toISOString();
      const { data: member, error } = await admin.from("merchant_team_members").insert({
        business_account_id: accountId,
        user_id: invitedUser.id,
        name,
        email,
        phone: phone || null,
        role,
        status: createdAuthUser ? "invited" : "active",
        invited_by: authData.user.id,
        joined_at: createdAuthUser ? null : now,
      }).select("id,user_id,name,email,phone,role,permissions,status,invited_at,joined_at,created_at").single();
      if (error) {
        if (createdAuthUser) await admin.auth.admin.deleteUser(invitedUser.id);
        return json({ error: error.message }, 500);
      }

      if (!createdAuthUser) {
        await publicAuthClient.auth.resetPasswordForEmail(email, { redirectTo });
      }
      await admin.from("merchant_console_activity_logs").insert({
        business_account_id: accountId,
        actor_user_id: authData.user.id,
        action: "invite",
        resource_type: "team_member",
        resource_id: member.id,
        details: { email, role },
      });
      return json({ success: true, member, invitation_sent: createdAuthUser });
    }

    const memberId = String(body.member_id || "");
    if (!memberId) return json({ error: "member_id required" }, 400);
    const { data: member } = await admin.from("merchant_team_members").select("*")
      .eq("id", memberId).eq("business_account_id", accountId).maybeSingle();
    if (!member) return json({ error: "Team member not found" }, 404);
    if (member.user_id === authData.user.id) return json({ error: "You cannot change your own access" }, 409);

    if (action === "update_role") {
      const role = String(body.role || "");
      if (!roles.has(role)) return json({ error: "Invalid merchant role" }, 400);
      const { data, error } = await admin.from("merchant_team_members").update({ role })
        .eq("id", member.id).eq("business_account_id", accountId)
        .select("id,user_id,name,email,phone,role,permissions,status,invited_at,joined_at,created_at").single();
      if (error) return json({ error: error.message }, 500);
      await admin.from("merchant_console_activity_logs").insert({ business_account_id: accountId, actor_user_id: authData.user.id, action: "update_role", resource_type: "team_member", resource_id: member.id, details: { email: member.email, from: member.role, to: role } });
      return json({ success: true, member: data });
    }

    if (action === "update_status") {
      const status = String(body.status || "");
      if (!statuses.has(status)) return json({ error: "Invalid team member status" }, 400);
      const { data, error } = await admin.from("merchant_team_members").update({ status })
        .eq("id", member.id).eq("business_account_id", accountId)
        .select("id,user_id,name,email,phone,role,permissions,status,invited_at,joined_at,created_at").single();
      if (error) return json({ error: error.message }, 500);
      await admin.from("merchant_console_activity_logs").insert({ business_account_id: accountId, actor_user_id: authData.user.id, action: status === "suspended" ? "suspend" : "reactivate", resource_type: "team_member", resource_id: member.id, details: { email: member.email } });
      return json({ success: true, member: data });
    }

    if (action === "resend") {
      const redirectTo = `${Deno.env.get("PUBLIC_SITE_URL") || "https://www.viasetu.com"}/viasetuforbusinesses/reset-password`;
      const { error } = await publicAuthClient.auth.resetPasswordForEmail(member.email, { redirectTo });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "remove") {
      const { error } = await admin.from("merchant_team_members").delete()
        .eq("id", member.id).eq("business_account_id", accountId);
      if (error) return json({ error: error.message }, 500);
      await admin.from("merchant_console_activity_logs").insert({ business_account_id: accountId, actor_user_id: authData.user.id, action: "remove", resource_type: "team_member", resource_id: member.id, details: { email: member.email, role: member.role } });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[merchant-team]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
