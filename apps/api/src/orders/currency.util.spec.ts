import { localToPkr, pkrToLocal } from './currency.util';

describe('PKR <-> local currency conversion (AC-8)', () => {
  it('converts PKR to a local amount using rateToPkr as "1 unit = rateToPkr PKR"', () => {
    // 1 USD = 278.5 PKR -> 27850 PKR = 100 USD
    expect(pkrToLocal(27850, 278.5)).toBe(100);
  });

  it('rounds to 2 decimal places', () => {
    expect(pkrToLocal(1000, 278.5)).toBe(3.59); // 1000/278.5 = 3.59066... -> 3.59
  });

  it('is the inverse of localToPkr', () => {
    const amountPkr = 5000;
    const rate = 278.5;
    const local = pkrToLocal(amountPkr, rate);
    expect(localToPkr(local, rate)).toBeCloseTo(amountPkr, -1); // within 5 PKR, allowing for the 2-decimal rounding on each leg
  });

  it('throws on a non-positive rate', () => {
    expect(() => pkrToLocal(100, 0)).toThrow();
    expect(() => pkrToLocal(100, -1)).toThrow();
    expect(() => localToPkr(100, 0)).toThrow();
  });
});
