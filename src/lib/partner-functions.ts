// Maps a booking's partner_id / courier_name to the partner edge functions
// used for tracking and label retrieval.
export type PartnerKey =
  | "delhivery"
  | "urbanebolt"
  | "xpressbees"
  | "shadowfax"
  | "shree_maruti";

export const resolvePartnerKey = (
  partnerId?: string | null,
  courierName?: string | null,
): PartnerKey | null => {
  const s = `${partnerId || ""} ${courierName || ""}`.toLowerCase();
  if (s.includes("delhivery")) return "delhivery";
  if (s.includes("urbane")) return "urbanebolt";
  if (s.includes("xpress")) return "xpressbees";
  if (s.includes("shadowfax")) return "shadowfax";
  if (s.includes("maruti") || s.includes("smile")) return "shree_maruti";
  return null;
};

export const trackingFunctionFor = (key: PartnerKey) => `${key.replace(/_/g, "-")}-tracking`;
export const labelFunctionFor = (key: PartnerKey) => `${key.replace(/_/g, "-")}-label`;

export const trackingBody = (key: PartnerKey, awb: string, orderId?: string | null) =>
  key === "shadowfax"
    ? { client_request_id: awb, awb, order_id: orderId || awb }
    : key === "shree_maruti"
      ? { waybill: awb, order_id: orderId || awb }
      : { waybill: awb, awb };

export const labelBody = (awb: string) => ({ waybill: awb, awb });
