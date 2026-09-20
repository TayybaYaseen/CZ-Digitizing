import { amountDuePkr, confirmedReceiptsTotalPkr, outstandingPkr, roundMoney } from './order-payment.util';

// A-013 — an order is fully paid when credits + confirmed bank receipts reach its total.
describe('order payment arithmetic', () => {
  const order = { totalPkr: 1500, creditsUsed: 0 };
  const receipt = (reviewStatus: string, confirmedAmountPkr: number | null) => ({ reviewStatus, confirmedAmountPkr });

  it('amount due is the total minus credits, never negative', () => {
    expect(amountDuePkr(order)).toBe(1500);
    expect(amountDuePkr({ totalPkr: 1500, creditsUsed: 500 })).toBe(1000);
    expect(amountDuePkr({ totalPkr: 1500, creditsUsed: 1500 })).toBe(0);
    expect(amountDuePkr({ totalPkr: 1500, creditsUsed: 9999 })).toBe(0);
  });

  it('only CONFIRMED receipts count, and only for the amount the admin confirmed', () => {
    expect(confirmedReceiptsTotalPkr([])).toBe(0);
    expect(confirmedReceiptsTotalPkr([receipt('pending', null), receipt('rejected', null)])).toBe(0);
    // a pending/rejected receipt never counts even if it somehow carries an amount
    expect(confirmedReceiptsTotalPkr([receipt('pending', 1500), receipt('rejected', 1500)])).toBe(0);
    expect(confirmedReceiptsTotalPkr([receipt('confirmed', 500), receipt('rejected', null), receipt('confirmed', 250.5)])).toBe(750.5);
    expect(confirmedReceiptsTotalPkr([receipt('confirmed', null)])).toBe(0);
  });

  it('outstanding = amount due - confirmed; partial payment leaves it above zero (order NOT paid)', () => {
    expect(outstandingPkr(order, [])).toBe(1500);
    expect(outstandingPkr(order, [receipt('confirmed', 500)])).toBe(1000);
    expect(outstandingPkr(order, [receipt('confirmed', 500), receipt('confirmed', 1000)])).toBe(0);
    expect(outstandingPkr(order, [receipt('confirmed', 1499.99)])).toBe(0.01);
  });

  it('credits count toward payment: 500 credits + 1,000 confirmed = fully paid; 500 credits alone is not', () => {
    const withCredits = { totalPkr: 1500, creditsUsed: 500 };
    expect(outstandingPkr(withCredits, [])).toBe(1000);
    expect(outstandingPkr(withCredits, [receipt('confirmed', 1000)])).toBe(0);
  });

  it('never goes negative when confirmations exceed the amount due', () => {
    expect(outstandingPkr(order, [receipt('confirmed', 2000)])).toBe(0);
  });

  it('rounds to whole paisas so float noise cannot fake or hide a shortfall', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(outstandingPkr({ totalPkr: 0.3, creditsUsed: 0 }, [receipt('confirmed', 0.1), receipt('confirmed', 0.2)])).toBe(0);
  });
});
