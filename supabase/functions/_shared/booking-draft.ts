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
