import { createContext, useContext } from "react";

export type BusinessAccount = {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  pan_number: string | null;
  gst_number: string | null;
  documents: unknown;
  monthly_shipments: number;
  approved_at: string | null;
  status: string;
  is_active: boolean;
};

export type BusinessAuthState = {
  loading: boolean;
  business: BusinessAccount | null;
  refresh: (showLoading?: boolean) => Promise<BusinessAccount | null>;
};

export const BusinessAuthContext = createContext<BusinessAuthState | undefined>(undefined);

export const useBusinessAuth = () => {
  const ctx = useContext(BusinessAuthContext);
  if (!ctx) throw new Error("useBusinessAuth must be used within BusinessAuthProvider");
  return ctx;
};
