import type { BillingPeriod } from '../generated/prisma';

// AC-2/AC-3 — pulled out as a pure function (mirrors orders/currency.util.ts's own shape) so the
// renewal-date arithmetic is unit-testable without a database.
export function computeRenewalDate(from: Date, billingPeriod: BillingPeriod): Date {
  const next = new Date(from);
  if (billingPeriod === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}
