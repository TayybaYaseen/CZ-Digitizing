import { assertValidCustomRequestTransition, isValidCustomRequestTransition, InvalidCustomRequestTransitionError } from './custom-request-state-machine';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-2.
describe('custom request status transitions', () => {
  it('allows the full happy-path chain', () => {
    const chain: Parameters<typeof isValidCustomRequestTransition>[0][] = [
      'new',
      'reviewing',
      'quote_sent',
      'approved',
      'in_production',
      'ready',
      'delivered',
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(isValidCustomRequestTransition(chain[i], chain[i + 1])).toBe(true);
    }
    expect(isValidCustomRequestTransition('delivered', 'completed')).toBe(true);
  });

  it('allows need_more_info/revision_required as side-states and their loop-back', () => {
    expect(isValidCustomRequestTransition('reviewing', 'need_more_info')).toBe(true);
    expect(isValidCustomRequestTransition('need_more_info', 'reviewing')).toBe(true);
    expect(isValidCustomRequestTransition('in_production', 'revision_required')).toBe(true);
    expect(isValidCustomRequestTransition('revision_required', 'in_production')).toBe(true);
  });

  it('allows cancellation from reviewing and in_production', () => {
    expect(isValidCustomRequestTransition('reviewing', 'cancelled')).toBe(true);
    expect(isValidCustomRequestTransition('in_production', 'cancelled')).toBe(true);
  });

  it('rejects illegal jumps, e.g. new -> completed directly', () => {
    expect(isValidCustomRequestTransition('new', 'completed')).toBe(false);
    expect(isValidCustomRequestTransition('new', 'in_production')).toBe(false);
    expect(isValidCustomRequestTransition('new', 'approved')).toBe(false);
  });

  it('rejects a no-op transition', () => {
    expect(isValidCustomRequestTransition('reviewing', 'reviewing')).toBe(false);
  });

  it('treats completed and cancelled as terminal', () => {
    expect(isValidCustomRequestTransition('completed', 'reviewing')).toBe(false);
    expect(isValidCustomRequestTransition('cancelled', 'reviewing')).toBe(false);
  });

  it('throws InvalidCustomRequestTransitionError for an illegal transition', () => {
    expect(() => assertValidCustomRequestTransition('new', 'completed')).toThrow(InvalidCustomRequestTransitionError);
  });

  it('does not throw for a legal transition', () => {
    expect(() => assertValidCustomRequestTransition('new', 'reviewing')).not.toThrow();
  });
});
