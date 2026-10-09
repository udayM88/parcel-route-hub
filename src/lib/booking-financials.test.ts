import { describe, test, expect } from 'bun:test';
import { bookingFinancials } from './booking-financials';
import { computePriceBreakdown } from './pricing';

const saved = { courier_price: 98, courier_rate: 29, base_fare: 83, platform_fee: 69, gst: 15, consumer_platform_fee: 25 };

describe('saved order accounting', () => {
  test('historical GST-inclusive revenue does not reduce the saved ₹29 courier cost', () => {
    const result = bookingFinancials(saved);
    expect(result.courierCost).toBe(29);
    expect(result.platformRevenue).toBe(54);
    expect(result.splitDifference).toBe(0);
    expect(result.needsReview).toBe(false);
  });
  test('future ₹29 consumer quote retains ₹98 total and ₹15 GST, with ₹54 net revenue', () => {
    const result = computePriceBreakdown(29);
    expect(result.total).toBe(98);
    expect(result.gst).toBe(15);
    expect(result.platformFee).toBe(54);
    expect(result.margin).toBe(54);
    expect(result.flatPlatformFee).toBe(25);
  });
  test('failed refunded booking retains quoted cost but has no outstanding payable', () => {
    const result = bookingFinancials({ ...saved, status: 'FAILED', payment_status: 'refunded' });
    expect(result.courierCost).toBe(29);
    expect(result.partnerPayable).toBe(0);
    expect(result.quoteOnly).toBe(true);
  });
  test('legacy rows without saved rate are not repriced and require review', () => {
    const result = bookingFinancials({ courier_price: 118, base_fare: 100, gst: 18, platform_fee: 40 });
    expect(result.courierCost).toBe(60);
    expect(result.platformRevenue).toBe(40);
    expect(result.needsReview).toBe(true);
  });
  test('an explicit zero courier rate is not treated as missing', () => {
    const result = bookingFinancials({ courier_price: 30, courier_rate: 0, base_fare: 25, gst: 5, platform_fee: 30 });
    expect(result.courierCost).toBe(0);
    expect(result.platformRevenue).toBe(25);
  });
  test('multi-box saved aggregate cost and extras are not counted twice', () => {
    const result = bookingFinancials({ courier_price: 218, courier_rate: 58, base_fare: 166, gst: 30, packaging_amount: 12, insurance_amount: 10 });
    expect(result.courierCost).toBe(58);
    expect(result.platformRevenue).toBe(108);
    expect(result.splitDifference).toBe(0);
  });
});