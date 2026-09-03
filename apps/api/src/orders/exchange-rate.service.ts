import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { pkrToLocal } from './currency.util';

// AC-8 — hourly-refreshed PKR conversion rates. Hardcoded fallback table used whenever
// EXCHANGE_RATE_API_KEY is unset (documented scope decision: no exchange-rate provider was
// finalized — spec §8 risk #3 — so this ships a real, working conversion path today and swaps to
// a live provider later purely inside refreshRates(), with zero change to any caller). Rates below
// are an approximate, periodically-stale snapshot (1 unit of currency = N PKR); good enough to
// satisfy "PKR and the converted local-currency amount both display" without blocking the rest of
// this feature on a vendor decision.
const FALLBACK_RATES_TO_PKR: Record<string, number> = {
  USD: 278.5,
  GBP: 352.0,
  EUR: 301.0,
  AED: 75.8,
  CAD: 203.0,
  AUD: 182.0,
  SAR: 74.3,
};

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly apiKey?: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.apiKey = config.get('EXCHANGE_RATE_API_KEY', { infer: true });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshRates(): Promise<void> {
    const rates = this.apiKey ? await this.fetchLiveRates() : FALLBACK_RATES_TO_PKR;
    await this.prisma.$transaction(
      Object.entries(rates).map(([currencyCode, rateToPkr]) =>
        this.prisma.exchangeRate.upsert({
          where: { currencyCode },
          create: { currencyCode, rateToPkr },
          update: { rateToPkr },
        }),
      ),
    );
    this.logger.log(`Refreshed ${Object.keys(rates).length} exchange rate(s)`);
  }

  // TODO(spec §8 risk #3): OpenExchangeRates vs. Fixer.io not finalized — this is a documented
  // placeholder shape for whichever is chosen; falls back to the hardcoded table on any failure so
  // a flaky/misconfigured provider never leaves ExchangeRate stale-and-silent.
  private async fetchLiveRates(): Promise<Record<string, number>> {
    try {
      const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${this.apiKey}&base=USD`);
      if (!response.ok) throw new Error(`Exchange rate provider returned ${response.status}`);
      const body = (await response.json()) as { rates: Record<string, number> };
      const usdToPkr = FALLBACK_RATES_TO_PKR.USD;
      const result: Record<string, number> = { USD: usdToPkr };
      for (const code of Object.keys(FALLBACK_RATES_TO_PKR)) {
        if (code === 'USD' || !body.rates[code]) continue;
        // body.rates[code] is "1 USD = N <code>" — invert and scale by USD->PKR to get <code>->PKR.
        result[code] = usdToPkr / body.rates[code];
      }
      return result;
    } catch (err) {
      this.logger.warn(`Exchange rate provider fetch failed, using fallback rates: ${(err as Error).message}`);
      return FALLBACK_RATES_TO_PKR;
    }
  }

  // AC-8 — returns null when no rate is on file yet (e.g. before the first cron tick in a fresh
  // environment, or an unsupported/typo'd currency code) so callers can fall back to PKR-only
  // display rather than throwing.
  async convert(amountPkr: number, currencyCode: string): Promise<number | null> {
    if (currencyCode.toUpperCase() === 'PKR') return amountPkr;
    const rate = await this.prisma.exchangeRate.findUnique({ where: { currencyCode: currencyCode.toUpperCase() } });
    if (!rate) return null;
    return pkrToLocal(amountPkr, Number(rate.rateToPkr));
  }
}
