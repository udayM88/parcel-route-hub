/** Historical accounting adapter. Never reprice a saved order using today's rates. */
export interface FinancialBooking {
  courier_price?: number | string | null;
  courier_rate?: number | string | null;
  base_fare?: number | string | null;
  platform_fee?: number | string | null;
  consumer_platform_fee?: number | string | null;
  gst?: number | string | null;
  packaging_amount?: number | string | null;
  insurance_amount?: number | string | null;
  status?: string | null;
  payment_status?: string | null;
}

const num = (value: unknown) => Number(value) || 0;
const money = (value: number) => Math.round(value * 100) / 100;

export function bookingFinancials(booking: FinancialBooking) {
  const total = num(booking.courier_price);
  const gst = num(booking.gst);
  const packaging = num(booking.packaging_amount);
  const insurance = num(booking.insurance_amount);
  const net = money(total - gst - packaging - insurance);
  const hasRate = booking.courier_rate != null && Number.isFinite(Number(booking.courier_rate)) && Number(booking.courier_rate) >= 0;
  const storedPlatform = num(booking.platform_fee);
  // Explicit saved courier rate is authoritative, including zero. Old rows with
  // no rate retain their stored pre-tax split and are marked for review.
  const courierCost = hasRate
    ? num(booking.courier_rate)
    : Math.max(0, money((booking.base_fare != null ? num(booking.base_fare) : net) - storedPlatform));
  const platformRevenue = hasRate ? money(net - courierCost) : storedPlatform;
  const splitDifference = money(courierCost + platformRevenue + gst + packaging + insurance - total);
  const needsReview = !hasRate || net < 0 || platformRevenue < 0 || Math.abs(splitDifference) > 1
    || (booking.base_fare != null && Math.abs(num(booking.base_fare) - net) > 1);
  const status = String(booking.status || '').toLowerCase();
  const payment = String(booking.payment_status || '').toLowerCase();
  const quoteOnly = ['failed', 'cancelled', 'canceled', 'pending_payment', 'payment_abandoned'].includes(status)
    || ['refunded', 'refund_failed', 'failed', 'pending'].includes(payment);
  return {
    total, gst, packaging, insurance, net, courierCost, platformRevenue,
    flatPlatformFee: num(booking.consumer_platform_fee),
    partnerPayable: quoteOnly ? 0 : courierCost,
    quoteOnly, needsReview, splitDifference,
    rateSource: hasRate ? 'saved_courier_rate' : 'legacy_stored_split',
  };
}