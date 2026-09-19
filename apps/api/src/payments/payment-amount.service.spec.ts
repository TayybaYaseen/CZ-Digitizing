import { PaymentAmountService } from './payment-amount.service';

function makeService(opts: { rate?: { rateToPkr: number; updatedAt: Date } | null; currency?: string; maxAgeHours?: number } = {}) {
  const rate = opts.rate === undefined ? { rateToPkr: 278.5, updatedAt: new Date() } : opts.rate;
  const rates = { getRate: jest.fn(async () => rate) };
  const config = { get: (key: string) => ({ PAYMENT_PROVIDER_CURRENCY: opts.currency ?? 'USD', PAYMENT_RATE_MAX_AGE_HOURS: opts.maxAgeHours ?? 24 })[key] };
  return { service: new PaymentAmountService(rates as never, config as never), rates };
}

describe('PaymentAmountService.quote (A-013: PKR -> provider currency, fail closed)', () => {
  it('quotes PKR 1,500 as USD 5.39 (539 cents) and records the PKR amount and rate it used', async () => {
    const { service, rates } = makeService();
    const quote = await service.quote(1500);
    expect(quote).toEqual({ amountPkr: 1500, rateToPkr: 278.5, currency: 'USD', amountMinor: 539, amountDecimal: '5.39' });
    expect(rates.getRate).toHaveBeenCalledWith('USD');
    // The two defects the audit found:
    expect(quote.amountDecimal).not.toBe('1500.00');
    expect(quote.amountMinor).not.toBe(150000);
  });

  it('uses the configured provider currency and its own rate', async () => {
    const { service, rates } = makeService({ currency: 'EUR', rate: { rateToPkr: 301, updatedAt: new Date() } });
    const quote = await service.quote(3010);
    expect(rates.getRate).toHaveBeenCalledWith('EUR');
    expect(quote).toMatchObject({ currency: 'EUR', amountMinor: 1000, amountDecimal: '10.00' });
  });

  it('refuses with 503 PAYMENT_CURRENCY_UNAVAILABLE when no rate is on file — never guesses one', async () => {
    const { service } = makeService({ rate: null });
    await expect(service.quote(1500)).rejects.toMatchObject({ code: 'PAYMENT_CURRENCY_UNAVAILABLE', status: 503 });
  });

  it('refuses a stale rate (older than the configured max age)', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const { service } = makeService({ rate: { rateToPkr: 278.5, updatedAt: twoDaysAgo } });
    await expect(service.quote(1500)).rejects.toMatchObject({ code: 'PAYMENT_CURRENCY_UNAVAILABLE', status: 503 });
  });

  it('accepts a rate inside the max age window', async () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { service } = makeService({ rate: { rateToPkr: 278.5, updatedAt: hourAgo } });
    await expect(service.quote(1500)).resolves.toMatchObject({ amountMinor: 539 });
  });

  it('refuses an amount that rounds to zero minor units (PAYMENT_AMOUNT_TOO_SMALL)', async () => {
    const { service } = makeService();
    await expect(service.quote(1)).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_TOO_SMALL', status: 422 });
  });
});
