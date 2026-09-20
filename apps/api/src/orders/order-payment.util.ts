// A-013 — how much of an order has actually been paid. Pure arithmetic, shared by the service (which
// decides whether an approval completes the order) and the DTO mapper (which shows the customer and
// Admin what is still owed), so the two can never disagree.
//
// An order is fully paid when  credits applied + confirmed bank-transfer receipts  >=  total. Only
// receipts an admin CONFIRMED count, and only for the amount the admin confirmed — a pending or
// rejected receipt, or anything the customer claims, contributes nothing.

export const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export interface ReceiptAmountView {
  reviewStatus: string;
  confirmedAmountPkr: { toString(): string } | number | null;
}

// Sum of what Admin confirmed as received across the order's receipts.
export function confirmedReceiptsTotalPkr(receipts: readonly ReceiptAmountView[]): number {
  return roundMoney(receipts.reduce((sum, r) => (r.reviewStatus === 'confirmed' ? sum + Number(r.confirmedAmountPkr ?? 0) : sum), 0));
}

// What the customer must TRANSFER by bank: the order total minus the credits applied to it.
export function amountDuePkr(order: { totalPkr: { toString(): string } | number; creditsUsed: { toString(): string } | number }): number {
  return roundMoney(Math.max(0, Number(order.totalPkr) - Number(order.creditsUsed)));
}

// What is still unpaid: the amount due minus what Admin has confirmed so far (never negative).
export function outstandingPkr(order: { totalPkr: { toString(): string } | number; creditsUsed: { toString(): string } | number }, receipts: readonly ReceiptAmountView[]): number {
  return roundMoney(Math.max(0, amountDuePkr(order) - confirmedReceiptsTotalPkr(receipts)));
}
