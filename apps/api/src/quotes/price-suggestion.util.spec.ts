import { suggestQuotePricePkr } from './price-suggestion.util';

// docs/specs/2026-08-28-11-smart-get-a-quote.md AC-8.
describe('suggestQuotePricePkr', () => {
  it('scales the per-type base rate by quantity', () => {
    expect(suggestQuotePricePkr({ serviceType: 'embroidery_digitizing', quantity: 3 })).toBe(1500 * 3);
    expect(suggestQuotePricePkr({ serviceType: 'vector_art', quantity: 2 })).toBe(1200 * 2);
  });

  it('defaults to quantity 1 when unset or invalid', () => {
    expect(suggestQuotePricePkr({ serviceType: 'embroidery_digitizing' })).toBe(1500);
    expect(suggestQuotePricePkr({ serviceType: 'embroidery_digitizing', quantity: 0 })).toBe(1500);
  });

  it('applies a rush surcharge when the deadline is within the rush window', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const soon = new Date('2026-01-02T00:00:00Z');
    expect(suggestQuotePricePkr({ serviceType: 'embroidery_digitizing', quantity: 1, deadline: soon, now })).toBe(Math.round(1500 * 1.2));
  });

  it('does not apply a rush surcharge for a distant deadline', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const distant = new Date('2026-02-01T00:00:00Z');
    expect(suggestQuotePricePkr({ serviceType: 'embroidery_digitizing', quantity: 1, deadline: distant, now })).toBe(1500);
  });

  it('does not apply a rush surcharge for a deadline already in the past', () => {
    const now = new Date('2026-01-05T00:00:00Z');
    const past = new Date('2026-01-01T00:00:00Z');
    expect(suggestQuotePricePkr({ serviceType: 'embroidery_digitizing', quantity: 1, deadline: past, now })).toBe(1500);
  });
});
