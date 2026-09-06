// docs/specs/2026-08-28-16-internationalization.md AC-9 (aspect A-021) — locale-aware number/date
// formatting via the browser's own Intl, keyed off useLocale()'s current locale. No new dependency.

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(value: Date | string, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}
