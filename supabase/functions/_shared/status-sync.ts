// Records a courier status into the audit trail and decides whether the event
// is a meaningful NEW event that should trigger an SMS notification.
// Deduplication is enforced in the database (shipment_status_events.dedupe_key),
// so polling, webhook retries and repeated API responses cannot notify twice.
import {
  normalizeCourierStatus, statusDedupeKey, statusRank,
  NOTIFIABLE_STATUSES, type RawCourierEvent, type ViaSetuStatus,
} from "./courier-status.ts";
import { toUtcIso } from "./ist-time.ts";
import { dispatchSms } from "./notify-sms.ts";

/** Canonical status -> configured SMS template event key. */
export const STATUS_EVENT_KEY: Record<string, string> = {
  ORDER_PLACED: "ORDER_PLACED",
  CONFIRMED: "ORDER_CONFIRMED",
  CANCELLED: "ORDER_CANCELLED",
  FAILED: "ORDER_FAILED",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELAYED: "DELAYED",
  RETURNED: "RETURNED",
};

export interface RecordResult {
  normalized: ViaSetuStatus;
  rawStatus: string;
  rawCode: string;
  softCancel: boolean;
  eventId: string | null;
  isNewEvent: boolean;
  notified: boolean;
  reason: string;
}

export async function recordCourierStatus(
  admin: any,
  booking: Record<string, any>,
  latest: RawCourierEvent,
  opts: { source?: string; partnerKey?: string | null } = {},
): Promise<RecordResult> {
  const n = normalizeCourierStatus(latest);
  const awb = booking.prayog_awb || booking.tracking_id || "";
  const eventTime = toUtcIso(latest?.timestamp);
  const source = opts.source || "cron";

  // Previously processed courier event for this booking.
  const { data: prevRows } = await admin
    .from("shipment_status_events")
    .select("normalized_status")
    .eq("booking_id", booking.id)
    .order("event_time", { ascending: false })
    .limit(1);
  const previous: string | null = prevRows?.[0]?.normalized_status ?? null;

  const dedupe = statusDedupeKey(booking.id, awb, n.normalized, n.rawStatus, eventTime);

  const { data: inserted, error: insErr } = await admin
    .from("shipment_status_events")
    .insert({
      booking_id: booking.id,
      awb,
      courier_name: booking.courier_name || null,
      partner_key: opts.partnerKey || null,
      raw_status: n.rawStatus,
      raw_code: n.rawCode || null,
      raw_payload: latest ?? {},
      normalized_status: n.normalized,
      previous_status: previous,
      event_time: eventTime,
      source,
      dedupe_key: dedupe,
    })
    .select("id")
    .maybeSingle();

  // Unique violation => we have already processed this exact courier event.
  if (insErr) {
    const duplicate = String(insErr.code) === "23505";
    console.log(
      `[status-sync] booking=${booking.id} awb=${awb} raw="${n.rawStatus}" -> ${n.normalized} ` +
      `(${duplicate ? "duplicate event, no SMS" : `insert failed: ${insErr.message}`})`,
    );
    return {
      ...n, eventId: null, isNewEvent: false, notified: false,
      reason: duplicate ? "duplicate courier event" : `insert failed: ${insErr.message}`,
    };
  }

  const eventId = inserted?.id ?? null;
  const sameAsPrevious = previous === n.normalized;
  const stale = previous ? statusRank(n.normalized) < statusRank(previous as ViaSetuStatus) : false;
  const notifiable = NOTIFIABLE_STATUSES.includes(n.normalized);

  let reason = "";
  let notified = false;

  if (sameAsPrevious) reason = "same as previously processed status";
  else if (stale) reason = `stale/out-of-order scan (${previous} -> ${n.normalized})`;
  else if (!notifiable) reason = `${n.normalized} is not a notifiable event`;
  else {
    dispatchSms(STATUS_EVENT_KEY[n.normalized] ?? n.normalized, booking.id, {
      statusEventId: eventId,
      normalizedStatus: n.normalized,
      vars: { status: n.rawStatus, courier_status: n.rawStatus, courier_code: n.rawCode },
    });
    notified = true;
    reason = `new event ${previous ?? "—"} -> ${n.normalized}; SMS dispatched`;
  }

  console.log(
    `[status-sync] booking=${booking.id} awb=${awb} courier=${booking.courier_name} ` +
    `raw="${n.rawStatus}"${n.rawCode ? `/${n.rawCode}` : ""} -> ${n.normalized} | prev=${previous ?? "—"} ` +
    `| ${reason}${n.note ? ` | ${n.note}` : ""}`,
  );

  return { ...n, eventId, isNewEvent: !sameAsPrevious && !stale, notified, reason };
}
