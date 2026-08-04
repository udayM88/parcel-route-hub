import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BusinessAuthContext } from "@/contexts/useBusinessAuth";
import type { BusinessAccount } from "@/contexts/useBusinessAuth";

const BusinessAuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessAccount | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBusiness(null);
        return;
      }
      const { data, error } = await supabase
        .from("business_accounts")
        .select("id,company_name,contact_person,email,phone,status,is_active")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setBusiness(null);
        return;
      }
      setBusiness(data as BusinessAccount);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let hasLoadedOnce = false;
    refresh(true).finally(() => { hasLoadedOnce = true; });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setBusiness(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        // Always re-fetch: the session may have changed after the initial load.
        refresh(!hasLoadedOnce);
      }
    });

    return () => subscription.unsubscribe();
  }, [refresh]);


  const value = useMemo(() => ({ loading, business, refresh }), [loading, business, refresh]);

  return <BusinessAuthContext.Provider value={value}>{children}</BusinessAuthContext.Provider>;
};

export { BusinessAuthProvider };
export { useBusinessAuth } from "@/contexts/useBusinessAuth";
export type { BusinessAccount } from "@/contexts/useBusinessAuth";
