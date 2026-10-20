import type { BusinessAccount } from "@/contexts/useBusinessAuth";

export const BUSINESS_DEMO_EMAIL = "demo@viasetu.local";
export const BUSINESS_DEMO_PASSWORD = "Demo@1234";

const DEMO_SESSION_KEY = "viasetu_business_demo_session";

export const BUSINESS_DEMO_ACCOUNT: BusinessAccount = {
  id: "00000000-0000-0000-0000-000000000000",
  company_name: "Sample Merchant",
  contact_person: "Demo Admin",
  email: BUSINESS_DEMO_EMAIL,
  phone: "+91 90000 00000",
  address: "Sample warehouse, MG Road",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411001",
  pan_number: "SAMPLE1234X",
  gst_number: "27SAMPLE1234X1Z5",
  documents: [{ type: "kyc", status: "verified" }],
  monthly_shipments: 250,
  approved_at: "2026-10-01T10:00:00.000Z",
  status: "approved",
  is_active: true,
};

export const isBusinessDemoSession = () =>
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  window.sessionStorage.getItem(DEMO_SESSION_KEY) === "active";

export const startBusinessDemoSession = () => {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  window.sessionStorage.setItem(DEMO_SESSION_KEY, "active");
  window.localStorage.setItem("viasetu_merchant_theme", "ocean");
  return true;
};

export const endBusinessDemoSession = () => {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(DEMO_SESSION_KEY);
};
