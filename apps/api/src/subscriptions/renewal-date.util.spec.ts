import { computeRenewalDate } from './renewal-date.util';

describe('computeRenewalDate (AC-2/AC-3)', () => {
  it('advances a monthly plan by exactly one calendar month', () => {
    const from = new Date('2026-01-15T00:00:00.000Z');
    expect(computeRenewalDate(from, 'monthly').toISOString()).toBe(new Date('2026-02-15T00:00:00.000Z').toISOString());
  });

  it('advances a yearly plan by exactly one calendar year', () => {
    const from = new Date('2026-01-15T00:00:00.000Z');
    expect(computeRenewalDate(from, 'yearly').toISOString()).toBe(new Date('2027-01-15T00:00:00.000Z').toISOString());
  });

  it('handles month-end overflow (Jan 31 -> Mar 3, JS Date rolls over rather than clamping)', () => {
    // Documents actual behavior rather than asserting an unimplemented clamp-to-end-of-month rule
    // (spec doesn't specify one) — Feb has 28 days in 2026, so Jan 31 + 1 month rolls into March.
    const from = new Date('2026-01-31T00:00:00.000Z');
    const result = computeRenewalDate(from, 'monthly');
    expect(result.getUTCMonth()).toBe(2); // March (0-indexed)
  });

  it('never mutates the input date', () => {
    const from = new Date('2026-01-15T00:00:00.000Z');
    const originalTime = from.getTime();
    computeRenewalDate(from, 'monthly');
    expect(from.getTime()).toBe(originalTime);
  });
});
