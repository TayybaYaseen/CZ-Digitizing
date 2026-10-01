// docs/specs/2026-08-28-16-internationalization.md AC-9 (aspect A-021) — locale-aware number/date
// formatting via the browser's own Intl, keyed off useLocale()'s current locale. No new dependency.
// (useLocale() also exposes bound formatNumber/formatDate/formatDateTime helpers for components.)
import { intlLocale } from '@/i18n/config';

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

// Bank transfer is settled in PKR, always: this formats the exact stored PKR amount ("PKR 1,500",
// "PKR 1,500.50") — never a converted or rounded figure. Fixed en-US grouping so the amount a customer
// is told to transfer reads the same on every device/locale.
export function formatPkr(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0;
  return `PKR ${rounded.toLocaleString('en-US', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: Date | string, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium' }).format(date);
}
