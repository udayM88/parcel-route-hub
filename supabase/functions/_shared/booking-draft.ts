// Shared mapping from the client-side booking draft to a `bookings` row.
// Used by razorpay-create-order (pre-payment PENDING_PAYMENT row) and
// razorpay-verify-payment (post-payment row), so both stay in sync.

export interface BookingDraft {
  sender_name?: string;
  sender_phone?: string;
  sender_address?: string;
  sender_city?: string;
  sender_state?: string;
  sender_pincode?: string;
  receiver_name?: string;
  receiver_phone?: string;
  receiver_address?: string;
  receiver_city?: string;
  receiver_state?: string;
  receiver_pincode?: string;
  goods_type?: string;
  package_weight?: string | number;
  length?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  shipment_value?: number | null;
  urgency?: string;
  courier_name?: string;
  courier_price?: number;
  delivery_time?: string;
  base_fare?: number;
  platform_fee?: number;
  consumer_platform_fee?: number;
  gst?: number;
  packaging_amount?: number;
  insurance_amount?: number;
  booking_source?: string;
  partner_id?: string;
  service_code?: string;
  courier_rate?: number;
  retail_price?: number;
  margin_amount?: number;
  account_type?: string;
  /** Optional multi-parcel payload (max 10). */
  boxes?: BoxDraft[];
}

export function buildBookingRow(draft: BookingDraft, userId: string) {
  return {
    user_id: userId,
    sender_name: draft.sender_name ?? "",
    sender_phone: draft.sender_phone ?? "",
    sender_address: draft.sender_address ?? "",
    sender_city: draft.sender_city ?? "",
    sender_state: draft.sender_state ?? "",
    sender_pincode: draft.sender_pincode ?? "",
    receiver_name: draft.receiver_name ?? "",
    receiver_phone: draft.receiver_phone ?? "",
    receiver_address: draft.receiver_address ?? "",
    receiver_city: draft.receiver_city ?? "",
    receiver_state: draft.receiver_state ?? "",
    receiver_pincode: draft.receiver_pincode ?? "",
    goods_type: draft.goods_type ?? "Package",
    package_weight: String(draft.package_weight ?? "1"),
    length: draft.length != null ? String(draft.length) : null,
    width: draft.width != null ? String(draft.width) : null,
    height: draft.height != null ? String(draft.height) : null,
    shipment_value: draft.shipment_value ?? null,
    urgency: draft.urgency ?? "standard",
    courier_name: draft.courier_name ?? "",
    courier_price: draft.courier_price ?? 0,
    delivery_time: draft.delivery_time ?? "Standard",
    base_fare: draft.base_fare ?? 0,
    platform_fee: draft.platform_fee ?? 0,
    consumer_platform_fee: draft.consumer_platform_fee ?? 0,
    gst: draft.gst ?? 0,
    packaging_amount: draft.packaging_amount ?? 0,
    insurance_amount: draft.insurance_amount ?? 0,
    booking_source: draft.booking_source ?? "unknown",
    partner_id: draft.partner_id ?? null,
    service_code: draft.service_code ?? null,
    courier_rate: draft.courier_rate ?? null,
    retail_price: draft.retail_price ?? null,
    margin_amount: draft.margin_amount ?? null,
    account_type: draft.account_type ?? "consumer",
  };
}

// ── Multi-parcel support ─────────────────────────────────────────
// A consumer order can carry up to 10 parcels shipped with one courier.
// Each parcel becomes a `booking_boxes` row and gets its own AWB + label.

export interface BoxDraft {
  weight_kg: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  chargeable_weight_kg?: number | null;
  courier_rate?: number | null;
  price?: number | null;
}

export const MAX_CONSUMER_BOXES = 10;

export function normalizeBoxes(boxes: unknown): BoxDraft[] {
  if (!Array.isArray(boxes)) return [];
  return boxes
    .slice(0, MAX_CONSUMER_BOXES)
    .map((b: any) => ({
      weight_kg: Number(b?.weight_kg) || 0,
      length_cm: b?.length_cm != null ? Number(b.length_cm) : null,
      width_cm: b?.width_cm != null ? Number(b.width_cm) : null,
      height_cm: b?.height_cm != null ? Number(b.height_cm) : null,
      chargeable_weight_kg: b?.chargeable_weight_kg != null ? Number(b.chargeable_weight_kg) : null,
      courier_rate: b?.courier_rate != null ? Number(b.courier_rate) : null,
      price: b?.price != null ? Number(b.price) : null,
    }))
    .filter((b) => b.weight_kg > 0);
}

/**
 * Persist parcel rows for a booking (idempotent). Only writes when the
 * booking has no boxes yet, so retries and re-verification never duplicate.
 */
export async function syncBookingBoxes(
  admin: any,
  bookingId: string,
  boxes: BoxDraft[],
): Promise<void> {
  const list = normalizeBoxes(boxes);
  if (list.length < 2) return; // single parcel keeps the legacy shape
  const { data: existing } = await admin
    .from("booking_boxes")
    .select("id")
    .eq("booking_id", bookingId)
    .limit(1);
  if (existing && existing.length) return;

  const rows = list.map((b, i) => ({
    booking_id: bookingId,
    box_index: i + 1,
    weight_kg: b.weight_kg,
    length_cm: b.length_cm,
    width_cm: b.width_cm,
    height_cm: b.height_cm,
    chargeable_weight_kg: b.chargeable_weight_kg ?? b.weight_kg,
    courier_rate: b.courier_rate,
    price: b.price,
    status: "pending",
  }));
  const { error } = await admin.from("booking_boxes").insert(rows);
  if (error) {
    console.error("[booking-draft] box insert failed:", error);
    return;
  }
  await admin.from("bookings").update({ box_count: rows.length }).eq("id", bookingId);
}
