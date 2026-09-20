import { assertValidOrderTransition, InvalidOrderTransitionError, isPaymentGatedStatus, isValidOrderTransition, statusAllowsFileAccess, orderAllowsFileAccess } from './order-state-machine';

describe('payment-gated statuses (A-013 critical fix: no manual payment bypass)', () => {
  it('payment_confirmed and refunded can only be reached through their own verified flow', () => {
    expect(isPaymentGatedStatus('payment_confirmed')).toBe(true);
    expect(isPaymentGatedStatus('refunded')).toBe(true);
  });

  it('every other status stays manually settable by Admin', () => {
    for (const s of ['pending', 'payment_pending', 'processing', 'ready', 'completed', 'cancelled'] as const) {
      expect(isPaymentGatedStatus(s)).toBe(false);
    }
  });

  it('a cancelled order has no way back to payment_confirmed at the state-machine level either', () => {
    expect(isValidOrderTransition('cancelled', 'payment_confirmed')).toBe(false);
    expect(isValidOrderTransition('refunded', 'payment_confirmed')).toBe(false);
    expect(isValidOrderTransition('completed', 'payment_confirmed')).toBe(false);
  });
});

describe('order state machine (spec §3)', () => {
  it('allows every step of the documented happy path', () => {
    const path: Parameters<typeof isValidOrderTransition>[] = [
      ['pending', 'payment_pending'],
      ['payment_pending', 'payment_confirmed'],
      ['payment_confirmed', 'processing'],
      ['processing', 'ready'],
      ['ready', 'completed'],
    ];
    for (const [from, to] of path) expect(isValidOrderTransition(from, to)).toBe(true);
  });

  it('allows the rejected-receipt branch back to payment_pending, and to cancelled', () => {
    expect(isValidOrderTransition('payment_pending', 'payment_confirmed')).toBe(true);
    expect(isValidOrderTransition('payment_pending', 'cancelled')).toBe(true);
    expect(isValidOrderTransition('pending', 'cancelled')).toBe(true);
  });

  it('allows a refund from payment_confirmed, processing, ready, or completed (AC-11)', () => {
    for (const from of ['payment_confirmed', 'processing', 'ready', 'completed'] as const) {
      expect(isValidOrderTransition(from, 'refunded')).toBe(true);
    }
  });

  it('rejects skipping states forward', () => {
    expect(isValidOrderTransition('pending', 'payment_confirmed')).toBe(false);
    expect(isValidOrderTransition('pending', 'processing')).toBe(false);
    expect(isValidOrderTransition('payment_pending', 'completed')).toBe(false);
  });

  it('rejects moving backward', () => {
    expect(isValidOrderTransition('processing', 'payment_confirmed')).toBe(false);
    expect(isValidOrderTransition('completed', 'ready')).toBe(false);
  });

  it('rejects a no-op transition to the same state', () => {
    expect(isValidOrderTransition('processing', 'processing')).toBe(false);
  });

  it('treats cancelled and refunded as terminal — nothing transitions out of cancelled', () => {
    expect(isValidOrderTransition('cancelled', 'pending')).toBe(false);
    expect(isValidOrderTransition('refunded', 'completed')).toBe(false);
  });

  it('assertValidOrderTransition throws InvalidOrderTransitionError on an invalid move', () => {
    expect(() => assertValidOrderTransition('pending', 'completed')).toThrow(InvalidOrderTransitionError);
    expect(() => assertValidOrderTransition('pending', 'payment_pending')).not.toThrow();
  });

  it('statusAllowsFileAccess (AC-6) is true from payment_confirmed onward through the happy path, false otherwise', () => {
    expect(statusAllowsFileAccess('pending')).toBe(false);
    expect(statusAllowsFileAccess('payment_pending')).toBe(false);
    expect(statusAllowsFileAccess('payment_confirmed')).toBe(true);
    expect(statusAllowsFileAccess('processing')).toBe(true);
    expect(statusAllowsFileAccess('ready')).toBe(true);
    expect(statusAllowsFileAccess('completed')).toBe(true);
    expect(statusAllowsFileAccess('cancelled')).toBe(false);
    expect(statusAllowsFileAccess('refunded')).toBe(false);
  });
});

// A-013 FINAL PAYMENT ACCESS POLICY: files unlock only when the order is 100% paid and admin-confirmed
// (paymentStatus 'completed', a post-payment status, no refund). Everything else is locked.
describe('orderAllowsFileAccess (final payment access policy)', () => {
  const statuses = ['pending', 'payment_pending', 'payment_confirmed', 'processing', 'ready', 'completed', 'cancelled', 'refunded'] as const;
  const paymentStatuses = ['pending', 'completed', 'refunded', 'partially_refunded', 'failed'] as const;

  it('unlocks ONLY for (fulfilment status) x paymentStatus "completed" with no refund recorded', () => {
    for (const status of statuses) {
      for (const paymentStatus of paymentStatuses) {
        const expected = paymentStatus === 'completed' && ['payment_confirmed', 'processing', 'ready', 'completed'].includes(status);
        expect({ status, paymentStatus, unlocked: orderAllowsFileAccess({ status, paymentStatus, refundedAmountPkr: null }) }).toEqual({ status, paymentStatus, unlocked: expected });
      }
    }
  });

  it('unpaid / awaiting payment / receipt pending or rejected (paymentStatus pending or failed) stay locked in every status', () => {
    for (const status of statuses) {
      expect(orderAllowsFileAccess({ status, paymentStatus: 'pending', refundedAmountPkr: null })).toBe(false);
      expect(orderAllowsFileAccess({ status, paymentStatus: 'failed', refundedAmountPkr: null })).toBe(false);
    }
  });

  it('a partial refund re-locks: partially_refunded is locked even while the fulfilment status still reads processing/ready/completed', () => {
    for (const status of ['payment_confirmed', 'processing', 'ready', 'completed'] as const) {
      expect(orderAllowsFileAccess({ status, paymentStatus: 'partially_refunded', refundedAmountPkr: 200 })).toBe(false);
    }
  });

  it('a full refund and a cancelled order are locked', () => {
    expect(orderAllowsFileAccess({ status: 'refunded', paymentStatus: 'refunded', refundedAmountPkr: 1500 })).toBe(false);
    expect(orderAllowsFileAccess({ status: 'cancelled', paymentStatus: 'completed', refundedAmountPkr: null })).toBe(false);
  });

  it('any recorded refund amount locks, even if paymentStatus somehow still reads completed (belt and braces)', () => {
    expect(orderAllowsFileAccess({ status: 'completed', paymentStatus: 'completed', refundedAmountPkr: 1 })).toBe(false);
    expect(orderAllowsFileAccess({ status: 'completed', paymentStatus: 'completed', refundedAmountPkr: { toString: () => '0.01' } })).toBe(false);
    expect(orderAllowsFileAccess({ status: 'completed', paymentStatus: 'completed', refundedAmountPkr: 0 })).toBe(true);
    expect(orderAllowsFileAccess({ status: 'completed', paymentStatus: 'completed', refundedAmountPkr: null })).toBe(true);
  });
});
