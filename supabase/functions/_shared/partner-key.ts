// Shared partner resolution for edge functions.
// Assisted / manually-attached bookings have booking_source like "admin_assisted",
// so never rely on booking_source alone — fall back to partner_id and courier_name.
export type PartnerKey =
  | "delhivery"
  | "urbanebolt"
  | "xpressbees"
  | "shadowfax"
  | "shree_maruti";

export const resolvePartnerKey = (
  ...candidates: (string | null | undefined)[]
): PartnerKey | null => {
  const s = candidates.filter(Boolean).join(" ").toLowerCase();
  if (s.includes("delhivery")) return "delhivery";
  if (s.includes("urbane")) return "urbanebolt";
  // Order matters: "Shadowfax Express" contains "xpress", so match shadowfax first
  // and only treat explicit xpressbees spellings as XpressBees.
  if (s.includes("shadowfax") || s.includes("sfx")) return "shadowfax";
  if (s.includes("xpressbees") || s.includes("expressbees")) return "xpressbees";
  if (s.includes("maruti") || s.includes("smile")) return "shree_maruti";
  return null;
};
