// A-013 (docs/specs/2026-08-28-08-orders-payment-processing.md, AC-1/AC-10) — pure PKR -> provider
// currency conversion. PKR is the source of truth for every order; PayPal/Stripe cannot settle PKR
// in this project's merchant setup, so the provider is charged in a fixed settlement currency
// (PAYMENT_PROVIDER_CURRENCY, USD by default) at the exchange rate on file (exchange_rates.rate_to_pkr
// = "1 unit of currency = N PKR"). This module never invents a rate and never assumes 1 PKR = 1 USD:
// the caller must supply the rate, and everything here is integer minor units (cents) so the amount
// sent to the provider and the amount later compared in the webhook are the same exact integer.

export interface ProviderAmount {
  currency: string;
  amountMinor: number;
  amountDecimal: string;
}

// Currencies whose minor unit is not 1/100 — the /100 arithmetic below would be wrong for them, so
// they are refused outright rather than silently mis-scaled.
const NON_TWO_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND', 'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX']);

export function minorToDecimal(amountMinor: number): string {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) throw new Error('amountMinor must be a non-negative integer');
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, '0')}`;
}

// Strict parse of a provider-reported decimal string ("5.39") into integer minor units. Returns
// null for anything that is not a plain non-negative amount with at most two decimals, so a
// malformed webhook value can never be coerced into a matching number.
export function decimalToMinor(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0') || '0');
  return whole * 100 + fraction;
}

export function toProviderAmount(amountPkr: number, rateToPkr: number, currency: string): ProviderAmount {
  const code = currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Invalid currency code: ${currency}`);
  if (code === 'PKR') throw new Error('PKR is the source-of-truth currency, not a provider settlement currency');
  if (NON_TWO_DECIMAL_CURRENCIES.has(code)) throw new Error(`${code} is not a two-decimal currency; unsupported as a provider currency`);
  if (!Number.isFinite(amountPkr) || amountPkr <= 0) throw new Error('amountPkr must be a positive number');
  if (!Number.isFinite(rateToPkr) || rateToPkr <= 0) throw new Error('rateToPkr must be a positive number');

  // (PKR paisa) / (PKR per 1 unit of currency) = minor units of currency.
  const amountMinor = Math.round((Math.round(amountPkr * 100) / rateToPkr));
  return { currency: code, amountMinor, amountDecimal: minorToDecimal(amountMinor) };
}
