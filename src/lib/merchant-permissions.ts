export const MERCHANT_PERMISSIONS = [
  "team:manage", "orders:read", "orders:write", "wallet:read", "wallet:manage",
  "integrations:read", "integrations:write", "settings:read", "settings:write",
  "support:read", "support:write", "reports:read",
] as const;

export type MerchantPermission = typeof MERCHANT_PERMISSIONS[number];
export type MerchantRole = "owner" | "admin" | "operations" | "finance" | "support" | "developer" | "viewer";

export type MerchantAccess = {
  business_account_id: string;
  role: MerchantRole;
  permissions: string[];
  member_id: string | null;
  name: string;
  email: string;
  status: string;
};
export const MERCHANT_ROLE_DETAILS: Record<Exclude<MerchantRole, "owner">, { label: string; description: string; permissions: MerchantPermission[] }> = {
  admin: { label: "Administrator", description: "Manages team access and every merchant operation.", permissions: [...MERCHANT_PERMISSIONS] },
  operations: { label: "Operations", description: "Creates shipments and manages day-to-day fulfilment.", permissions: ["orders:read", "orders:write", "wallet:read", "integrations:read", "settings:read", "support:read", "support:write", "reports:read"] },
  finance: { label: "Finance", description: "Reviews statements and manages prepaid wallet funding.", permissions: ["orders:read", "wallet:read", "wallet:manage", "reports:read"] },
  support: { label: "Support", description: "Tracks orders and handles merchant support activity.", permissions: ["orders:read", "integrations:read", "support:read", "support:write", "reports:read"] },
  developer: { label: "Developer", description: "Manages API keys, webhooks and technical integrations.", permissions: ["orders:read", "integrations:read", "integrations:write", "settings:read", "reports:read"] },
  viewer: { label: "Viewer", description: "Read-only access to operational merchant information.", permissions: ["orders:read", "wallet:read", "integrations:read", "settings:read", "support:read", "reports:read"] },
};
