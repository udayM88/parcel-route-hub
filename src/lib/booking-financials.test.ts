import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected) });
import { bookingFinancials } from './booking-financials';
import { computePriceBreakdown } from './pricing';
import * as XLSX from 'xlsx';
import { buildAccountsWorkbook } from './accounts-export';
import { buildCaWorkbook, type CaReportData } from './ca-report';

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
  test('business revenue excludes GST without changing the customer total', () => {
    const result = computePriceBreakdown(29, 'business');
    expect(result.total).toBe(52);
    expect(result.gst).toBe(8);
    expect(result.platformFee).toBe(15);
  });
  test('accounts Excel keeps the historical ₹98 total and corrected ₹29/₹54 split', async () => {
    const blob = buildAccountsWorkbook([{ ...saved, id: 'historical', tracking_id: null, courier_name: 'Urbanebolt', status: 'FAILED', payment_status: 'refunded', created_at: '2026-10-08T09:44:14Z' }], { rangeLabel: 'October' });
    const workbook = XLSX.read(await blob.arrayBuffer());
    const sheet = workbook.Sheets['Orders'];
    expect(sheet.AA2.v).toBe(29);
    expect(sheet.AB2.v).toBe(54);
    expect(sheet.AJ2.v).toBe(98);
    expect(sheet.AK2.v).toBe(0);
    expect(sheet.AL2.v).toBe(0);
  });
  test('CA Excel uses corrected saved-cost revenue while preserving refund tax reversal', async () => {
    const created = Math.floor(new Date('2026-10-08T09:44:14Z').getTime() / 1000);
    const data = {
      range: { from: '2026-10-01T00:00:00Z', to: '2026-10-31T23:59:59Z' },
      payments: [{ id: 'pay-test', amount: 9800, amount_refunded: 9800, status: 'captured', created_at: created }],
      refunds: [{ id: 'refund-test', payment_id: 'pay-test', amount: 9800, status: 'processed', created_at: created + 30 }],
      bookings: [{ ...saved, id: 'historical', payment_id: 'pay-test', status: 'FAILED', payment_status: 'refunded', created_at: '2026-10-08T09:44:14Z' }],
      exceptions: [], cancellation_events: {},
    } as unknown as CaReportData;
    const workbook = XLSX.read(await buildCaWorkbook(data).arrayBuffer());
    expect(workbook.Sheets['Sales Register'].V2.v).toBe(29);
    expect(workbook.Sheets['Sales Register'].W2.v).toBe(54);
    expect(workbook.Sheets['Sales Register'].AA2.v).toBe(0);
    expect(workbook.Sheets['Credit Notes'].Q2.v).toBe(15);
  });
});