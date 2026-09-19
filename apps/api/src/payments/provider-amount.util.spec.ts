import { decimalToMinor, minorToDecimal, toProviderAmount } from './provider-amount.util';

// A-013 critical fix #2 — the audit found PKR 1,500 sent to PayPal as "USD 1500.00" and to Stripe as
// 150,000 US cents (~278x over-charge). These tests pin the corrected behaviour.
describe('toProviderAmount (PKR -> provider currency)', () => {
  const USD_RATE = 278.5; // 1 USD = 278.5 PKR

  it('PKR 1,500 becomes USD 5.39 / 539 cents — NOT USD 1,500.00 and NOT 150,000 cents', () => {
    const result = toProviderAmount(1500, USD_RATE, 'USD');
    expect(result).toEqual({ currency: 'USD', amountMinor: 539, amountDecimal: '5.39' });
    expect(result.amountDecimal).not.toBe('1500.00');
    expect(result.amountMinor).not.toBe(150000);
  });

  it('uses the supplied rate (never a hard-coded 1:1) — a different rate gives a different amount', () => {
    expect(toProviderAmount(1500, 300, 'USD').amountMinor).toBe(500);
    expect(toProviderAmount(1500, 150, 'USD').amountMinor).toBe(1000);
  });

  it('rounds to the nearest cent and never returns a float', () => {
    const { amountMinor } = toProviderAmount(2785, USD_RATE, 'USD');
    expect(Number.isInteger(amountMinor)).toBe(true);
    expect(amountMinor).toBe(1000);
    expect(toProviderAmount(1, USD_RATE, 'USD').amountMinor).toBe(0); // caller must treat 0 as "too small"
  });

  it('normalises the currency code to upper case', () => {
    expect(toProviderAmount(1500, USD_RATE, 'usd').currency).toBe('USD');
  });

  it('refuses PKR as a provider currency, non-two-decimal currencies, bad codes, and bad numbers', () => {
    expect(() => toProviderAmount(1500, 1, 'PKR')).toThrow();
    expect(() => toProviderAmount(1500, 2, 'JPY')).toThrow();
    expect(() => toProviderAmount(1500, USD_RATE, 'US')).toThrow();
    expect(() => toProviderAmount(0, USD_RATE, 'USD')).toThrow();
    expect(() => toProviderAmount(-5, USD_RATE, 'USD')).toThrow();
    expect(() => toProviderAmount(1500, 0, 'USD')).toThrow();
    expect(() => toProviderAmount(1500, Number.NaN, 'USD')).toThrow();
  });
});

describe('minorToDecimal / decimalToMinor', () => {
  it('formats integer minor units as a two-decimal string', () => {
    expect(minorToDecimal(539)).toBe('5.39');
    expect(minorToDecimal(500)).toBe('5.00');
    expect(minorToDecimal(5)).toBe('0.05');
    expect(minorToDecimal(0)).toBe('0.00');
  });

  it('rejects non-integer / negative minor units', () => {
    expect(() => minorToDecimal(5.5)).toThrow();
    expect(() => minorToDecimal(-1)).toThrow();
  });

  it('parses a provider-reported decimal string strictly', () => {
    expect(decimalToMinor('5.39')).toBe(539);
    expect(decimalToMinor('5.3')).toBe(530);
    expect(decimalToMinor('5')).toBe(500);
    expect(decimalToMinor('1500.00')).toBe(150000);
    expect(decimalToMinor('0.01')).toBe(1);
  });

  it('returns null for anything that is not a plain non-negative amount', () => {
    for (const bad of ['', 'abc', '5.399', '-1.00', '1e3', '5,39', ' ', null, undefined, 5.39, {}]) {
      expect(decimalToMinor(bad)).toBeNull();
    }
  });

  it('round-trips', () => {
    for (const minor of [0, 1, 99, 100, 539, 123456]) expect(decimalToMinor(minorToDecimal(minor))).toBe(minor);
  });
});
