import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BusinessAuthContext } from "@/contexts/useBusinessAuth";
import type { BusinessAccount } from "@/contexts/useBusinessAuth";
import { BUSINESS_DEMO_ACCOUNT, isBusinessDemoSession } from "@/lib/business-demo";
import type { MerchantAccess, MerchantPermission } from "@/lib/merchant-permissions";

const db = supabase as typeof supabase & { rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }> };

const demoAccess: MerchantAccess = {
  business_account_id: BUSINESS_DEMO_ACCOUNT.id,
  role: "owner",
  permissions: ["*"],
  member_id: null,
  name: BUSINESS_DEMO_ACCOUNT.contact_person,
  email: BUSINESS_DEMO_ACCOUNT.email,
  status: "active",
};

const BusinessAuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessAccount | null>(null);
  const [access, setAccess] = useState<MerchantAccess | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (isBusinessDemoSession()) {
        setBusiness(BUSINESS_DEMO_ACCOUNT);
        setAccess(demoAccess);
        return BUSINESS_DEMO_ACCOUNT;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setBusiness(null);
        setAccess(null);
        return null;
      }
      const accessResult = await db.rpc("merchant_current_access");
      let resolvedAccess = accessResult.data as MerchantAccess | null;
      if (accessResult.error) {
        // Backward-compatible owner lookup while the additive migration is rolling out.
        const { data: legacyOwner } = await supabase.from("business_accounts")
          .select("id,contact_person,email").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        resolvedAccess = legacyOwner ? {
          business_account_id: legacyOwner.id, role: "owner", permissions: ["*"], member_id: null,
          name: legacyOwner.contact_person, email: legacyOwner.email, status: "active",
        } : null;
      }
      if (!resolvedAccess?.business_account_id) {
        setBusiness(null);
        setAccess(null);
        return null;
      }
      const { data, error } = await supabase
        .from("business_accounts")
        .select("id,company_name,contact_person,email,phone,address,city,state,pincode,pan_number,gst_number,documents,monthly_shipments,approved_at,status,is_active")
        .eq("id", resolvedAccess.business_account_id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        setBusiness(null);
        setAccess(null);
        throw error;
      }
      const account = data as BusinessAccount | null;
      setBusiness(account);
      setAccess(account ? resolvedAccess : null);
      return account;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let hasLoadedOnce = false;
    refresh(true).catch(() => undefined).finally(() => { hasLoadedOnce = true; });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (isBusinessDemoSession()) {
        setBusiness(BUSINESS_DEMO_ACCOUNT);
        setAccess(demoAccess);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        setBusiness(null);
        setAccess(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        // Always re-fetch: the session may have changed after the initial load.
        refresh(!hasLoadedOnce).catch(() => undefined);
      }
    });

    return () => subscription.unsubscribe();
  }, [refresh]);


  const can = useCallback((permission: MerchantPermission) =>
    !!access && (access.role === "owner" || access.permissions.includes("*") || access.permissions.includes(permission)), [access]);
  const value = useMemo(() => ({ loading, business, access, can, refresh }), [loading, business, access, can, refresh]);

  return <BusinessAuthContext.Provider value={value}>{children}</BusinessAuthContext.Provider>;
};

export { BusinessAuthProvider };
export { useBusinessAuth } from "@/contexts/useBusinessAuth";
export type { BusinessAccount } from "@/contexts/useBusinessAuth";
