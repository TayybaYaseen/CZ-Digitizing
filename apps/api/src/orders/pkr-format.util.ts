// Bank transfer is settled in PKR, always — so every customer-facing message names the exact PKR
// amount, e.g. "PKR 1,500" or "PKR 1,500.50". No currency conversion happens anywhere in the
// payment flow; this only formats the stored PKR figure.
export function formatPkr(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0;
  return `PKR ${rounded.toLocaleString('en-US', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })}`;
}
