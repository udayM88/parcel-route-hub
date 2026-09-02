// Centralised courier status normalisation.
// Every partner (Delhivery, XpressBees, Shadowfax, UrbaneBolt, Shree Maruti)
// reports its own status strings/codes. This is the ONE place that maps them
// into ViaSetu's canonical statuses. Never infer a courier's state from the
// ViaSetu booking status — always feed the raw partner payload through here.

export type ViaSetuStatus =
  | "ORDER_PLACED"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELAYED"
  | "FAILED"
  | "CANCELLED"
  | "DELIVERED"
  | "RETURNED";

export const TERMINAL_STATUSES: ViaSetuStatus[] = ["DELIVERED", "CANCELLED", "RETURNED"];

/** Statuses that are "meaningful new events" worth notifying about. */
export const NOTIFIABLE_STATUSES: ViaSetuStatus[] = [
  "CONFIRMED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELAYED",
  "FAILED", "CANCELLED", "DELIVERED", "RETURNED",
];

/** Progression rank — used to ignore out-of-order/stale partner scans. */
const RANK: Record<ViaSetuStatus, number> = {
  ORDER_PLACED: 0,
  CONFIRMED: 1,
  IN_TRANSIT: 2,
  DELAYED: 2,
  OUT_FOR_DELIVERY: 3,
  FAILED: 4,
  RETURNED: 4,
  CANCELLED: 5,
  DELIVERED: 6,
};

export const statusRank = (s: ViaSetuStatus): number => RANK[s] ?? 0;

export interface RawCourierEvent {
  status?: unknown;       // human status / subcategory
  subcategory?: unknown;
  category?: unknown;
  statusCode?: unknown;   // partner short code (PND, UD, DL, RT ...)
  code?: unknown;
  remarks?: unknown;
  instructions?: unknown;
  timestamp?: unknown;
  location?: unknown;
  [k: string]: unknown;
}

export interface NormalizedStatus {
  normalized: ViaSetuStatus;
  rawStatus: string;
  rawCode: string;
  /** Partner "soft" events that must NOT be treated as their literal wording. */
  softCancel: boolean;
  note: string;
}

const norm = (v: unknown) => String(v ?? "").trim();
const key = (v: unknown) => norm(v).toLowerCase().replace(/[\s-]+/g, "_");

// Partner short codes that are unambiguous across integrations.
const CODE_MAP: Record<string, ViaSetuStatus> = {
  // Delhivery / XpressBees style
  DL: "DELIVERED",
  DLVD: "DELIVERED",
  UD: "IN_TRANSIT",
  IT: "IN_TRANSIT",
  OFD: "OUT_FOR_DELIVERY",
  OD: "OUT_FOR_DELIVERY",
  RT: "RETURNED",
  RTO: "RETURNED",
  RTD: "RETURNED",
  CAN: "CANCELLED",
  CN: "CANCELLED",
  // Failed / pending pickup attempt — a delay, never a cancellation.
  PND: "DELAYED",
  NDR: "DELAYED",
  EXC: "DELAYED",
  MAN: "CONFIRMED",
  PU: "IN_TRANSIT",
};

export function normalizeCourierStatus(event: RawCourierEvent | null | undefined): NormalizedStatus {
  const rawStatus = norm(event?.subcategory) || norm(event?.status) || norm(event?.category);
  const rawCode = (norm(event?.statusCode) || norm(event?.code)).toUpperCase();
  const category = key(event?.category);
  const s = key(rawStatus);
  const text = `${s} ${key(event?.remarks)} ${key(event?.instructions)}`;

  const note: string[] = [];

  // XpressBees emits "Order got cancelled" with statusCode PND while the
  // tracking category is still ORDER_CONFIRMED — a failed pickup attempt that
  // resumes the next day, not a real cancellation.
  const looksCancelled = /cancel/.test(text);
  const softCancel = looksCancelled && (rawCode === "PND" || category === "order_confirmed");
  if (softCancel) note.push("soft-cancel ignored (failed pickup attempt)");

  let normalized: ViaSetuStatus | null = null;

  if (softCancel) {
    normalized = "DELAYED";
  } else if (/rto|return/.test(text)) {
    normalized = "RETURNED";
  } else if (looksCancelled) {
    normalized = "CANCELLED";
  } else if (/deliver/.test(text) && !/out_for|undeliver|not_deliver/.test(text)) {
    normalized = "DELIVERED";
  } else if (/out_for_delivery|\bofd\b/.test(text)) {
    normalized = "OUT_FOR_DELIVERY";
  } else if (/undeliver|not_deliver|failed|exception|delay|ndr|held|hold|misroute|damage/.test(text)) {
    normalized = /failed_?(booking|shipment)|booking_failed/.test(text) ? "FAILED" : "DELAYED";
  } else if (/in_transit|intransit|transit|reached|dispatch|bagged|shipped|picked|pickup_done|out_for_pickup/.test(text)) {
    normalized = "IN_TRANSIT";
  } else if (/manifest|confirmed|booked|assigned|ready_for_dispatch|awb|label/.test(text)) {
    normalized = "CONFIRMED";
  } else if (/created|pending|new|order_received|order_placed/.test(text) || s === "") {
    normalized = "ORDER_PLACED";
  }

  if (!normalized && rawCode && CODE_MAP[rawCode]) {
    normalized = CODE_MAP[rawCode];
    note.push(`mapped from code ${rawCode}`);
  }

  if (!normalized) {
    // Unknown wording — fall back to the coarse category, never to a terminal state.
    if (category.includes("deliver")) normalized = "DELIVERED";
    else if (category.includes("transit")) normalized = "IN_TRANSIT";
    else if (category.includes("confirmed")) normalized = "CONFIRMED";
    else normalized = "IN_TRANSIT";
    note.push(`unmapped status "${rawStatus}" -> ${normalized}`);
  }

  return { normalized, rawStatus: rawStatus || rawCode || "unknown", rawCode, softCancel, note: note.join("; ") };
}

/** Stable dedupe key so the same partner event never produces two SMS. */
export function statusDedupeKey(
  bookingId: string,
  awb: string,
  normalized: string,
  rawStatus: string,
  eventTimeIso: string,
): string {
  return [bookingId, awb || "-", normalized, rawStatus.toLowerCase(), eventTimeIso].join("|");
}
