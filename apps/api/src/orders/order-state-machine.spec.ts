import { assertValidOrderTransition, InvalidOrderTransitionError, isValidOrderTransition, statusAllowsFileAccess } from './order-state-machine';

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
