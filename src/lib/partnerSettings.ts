import { supabase } from "@/integrations/supabase/client";

export type PartnerToggle = { enabled: boolean; note?: string };
export type PartnerToggleMap = Record<string, PartnerToggle>;

export const PARTNER_REGISTRY: { code: string; name: string }[] = [
  { code: "delhivery", name: "Delhivery" },
  { code: "shree_maruti", name: "Shree Maruti Courier" },
  { code: "xpressbees", name: "XpressBees" },
  { code: "shadowfax", name: "Shadowfax" },
  { code: "urbanebolt", name: "UrbaneBolt" },
];

export const SETTINGS_KEY = "courier_partners";

/**
 * Reads the admin-controlled partner on/off map. Fail-open: a read error must
 * never block quoting, the edge functions enforce the same toggle server-side.
 */
export async function fetchPartnerToggles(): Promise<PartnerToggleMap> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (error) throw error;
    return ((data?.value ?? {}) as PartnerToggleMap) || {};
  } catch (err) {
    console.warn("[partnerSettings] failed to load toggles", err);
    return {};
  }
}

export function isEnabled(map: PartnerToggleMap, code: string): boolean {
  return map[code]?.enabled !== false;
}

/** Filters any list of partner descriptors down to the ones admins left enabled. */
export async function filterEnabledPartners<T extends { code: string }>(partners: T[]): Promise<T[]> {
  const map = await fetchPartnerToggles();
  return partners.filter((p) => isEnabled(map, p.code));
}
