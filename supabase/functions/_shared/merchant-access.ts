import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export const MERCHANT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["team:manage", "orders:read", "orders:write", "wallet:read", "wallet:manage", "integrations:read", "integrations:write", "settings:read", "settings:write", "support:read", "support:write", "reports:read"],
  operations: ["orders:read", "orders:write", "wallet:read", "integrations:read", "settings:read", "support:read", "support:write", "reports:read"],
  finance: ["orders:read", "wallet:read", "wallet:manage", "reports:read"],
  support: ["orders:read", "integrations:read", "support:read", "support:write", "reports:read"],
  developer: ["orders:read", "integrations:read", "integrations:write", "settings:read", "reports:read"],
  viewer: ["orders:read", "wallet:read", "integrations:read", "settings:read", "support:read", "reports:read"],
};

export type MerchantAccess = {
  business_account_id: string;
  role: string;
  permissions: string[];
  member_id: string | null;
  user: User;
};

export async function resolveMerchantAccess(
  admin: SupabaseClient,
  user: User,
): Promise<MerchantAccess | null> {
  const { data: owner } = await admin.from("business_accounts").select("id,status,is_active")
    .eq("user_id", user.id).eq("is_active", true).eq("status", "approved").maybeSingle();
  if (owner) {
    return { business_account_id: owner.id, role: "owner", permissions: ["*"], member_id: null, user };
  }

  const { data: member } = await admin.from("merchant_team_members")
    .select("id,business_account_id,role,permissions,status")
    .eq("user_id", user.id).in("status", ["invited", "active"]).maybeSingle();
  if (!member) return null;

  const { data: account } = await admin.from("business_accounts").select("id")
    .eq("id", member.business_account_id).eq("is_active", true).eq("status", "approved").maybeSingle();
  if (!account) return null;

  if (member.status === "invited") {
    await admin.from("merchant_team_members").update({ status: "active", joined_at: new Date().toISOString() }).eq("id", member.id);
  } else {
    await admin.from("merchant_team_members").update({ last_active_at: new Date().toISOString() }).eq("id", member.id);
  }
  const permissions = [...new Set([...(MERCHANT_ROLE_PERMISSIONS[member.role] || []), ...((member.permissions as string[]) || [])])];
  return { business_account_id: member.business_account_id, role: member.role, permissions, member_id: member.id, user };
}

export function merchantCan(access: MerchantAccess | null, permission: string) {
  return !!access && (access.role === "owner" || access.permissions.includes("*") || access.permissions.includes(permission));
}
