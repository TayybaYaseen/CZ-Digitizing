// AC-8 — PKR is always the source of truth; ExchangeRate.rateToPkr means "1 unit of
// currencyCode = rateToPkr PKR", so converting the other direction divides.
export function pkrToLocal(amountPkr: number, rateToPkr: number): number {
  if (rateToPkr <= 0) throw new Error('rateToPkr must be positive');
  return Math.round((amountPkr / rateToPkr) * 100) / 100;
}

export function localToPkr(amountLocal: number, rateToPkr: number): number {
  if (rateToPkr <= 0) throw new Error('rateToPkr must be positive');
  return Math.round(amountLocal * rateToPkr * 100) / 100;
}
