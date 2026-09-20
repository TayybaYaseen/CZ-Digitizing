import { formatPkr } from './pkr-format.util';

describe('formatPkr', () => {
  it('names the exact PKR amount, with no currency conversion', () => {
    expect(formatPkr(1500)).toBe('PKR 1,500');
    expect(formatPkr(150000)).toBe('PKR 150,000');
    expect(formatPkr(0)).toBe('PKR 0');
  });

  it('shows paisa only when there is a fractional part', () => {
    expect(formatPkr(1500.5)).toBe('PKR 1,500.50');
    expect(formatPkr(99.99)).toBe('PKR 99.99');
  });

  it('rounds float noise instead of leaking it', () => {
    expect(formatPkr(0.1 + 0.2)).toBe('PKR 0.30');
  });
});
