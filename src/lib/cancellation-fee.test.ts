import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeCancellationQuote } from '../../supabase/functions/_shared/cancellation-fee';

const created = '2026-10-22T10:00:00Z';
const at = (min: number) => new Date(new Date(created).getTime() + min * 60000);

describe('stage-based cancellation charges', () => {
  test('within 30 minutes: ₹35 deducted from ₹200', () => {
    const q = computeCancellationQuote({ amountPaid: 200, createdAt: created, status: 'MANIFESTED', now: at(10) });
    assert.equal(q.stage, 'grace');
    assert.equal(q.deduction, 35);
    assert.equal(q.refundAmount, 165);
  });
  test('after 30 minutes, no rider: ₹65', () => {
    const q = computeCancellationQuote({ amountPaid: 200, createdAt: created, status: 'manifested', now: at(45) });
    assert.equal(q.stage, 'pre_pickup');
    assert.equal(q.deduction, 65);
  });
  test('out for pickup: ₹99', () => {
    const q = computeCancellationQuote({ amountPaid: 200, createdAt: created, status: 'Out for Pickup', now: at(5) });
    assert.equal(q.stage, 'pickup_attempted');
    assert.equal(q.deduction, 99);
    assert.equal(q.refundAmount, 101);
  });
  test('deduction capped at amount paid', () => {
    const q = computeCancellationQuote({ amountPaid: 80, createdAt: created, status: 'out_for_pickup', now: at(5) });
    assert.equal(q.deduction, 80);
    assert.equal(q.refundAmount, 0);
  });
  test('waived cancellations refund 100%', () => {
    const q = computeCancellationQuote({ amountPaid: 200, createdAt: created, status: 'manifested', now: at(45), waived: true });
    assert.equal(q.refundAmount, 200);
  });
  test('picked-up orders are not cancellable online', () => {
    const q = computeCancellationQuote({ amountPaid: 200, createdAt: created, status: 'IN_TRANSIT', now: at(5) });
    assert.equal(q.stage, 'not_allowed');
  });
});
