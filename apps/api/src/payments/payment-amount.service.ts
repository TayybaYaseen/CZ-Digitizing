import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { ApiException } from '../common/exceptions/api-exception';
import { ExchangeRateService } from '../orders/exchange-rate.service';
import { toProviderAmount } from './provider-amount.util';

export interface PaymentQuote {
  // The PKR amount this quote was computed for (source of truth) and the rate used, so the
  // provider amount is always traceable back to it.
  amountPkr: number;
  rateToPkr: number;
  currency: string;
  amountMinor: number;
  amountDecimal: string;
}

// A-013 — the single place a PKR amount becomes a provider (PayPal/Stripe) amount. Fails CLOSED:
// if there is no usable exchange rate it throws instead of guessing, so a customer is never charged
// on an invented or ancient rate. Orders lock the returned quote (orders.provider_*) so the webhook
// later compares against the exact amount the customer agreed to.
@Injectable()
export class PaymentAmountService {
  private readonly logger = new Logger(PaymentAmountService.name);
  private readonly currency: string;
  private readonly maxAgeMs: number;

  constructor(
    private readonly rates: ExchangeRateService,
    config: ConfigService<Env, true>,
  ) {
    this.currency = config.get('PAYMENT_PROVIDER_CURRENCY', { infer: true });
    this.maxAgeMs = config.get('PAYMENT_RATE_MAX_AGE_HOURS', { infer: true }) * 60 * 60 * 1000;
  }

  get providerCurrency(): string {
    return this.currency;
  }

  async quote(amountPkr: number): Promise<PaymentQuote> {
    const rate = await this.rates.getRate(this.currency);
    if (!rate) {
      this.logger.error(`No exchange rate on file for ${this.currency} — refusing to create a provider payment`);
      throw new ApiException('PAYMENT_CURRENCY_UNAVAILABLE', 503, 'Card/PayPal payments are temporarily unavailable (no exchange rate). Please use bank transfer or try again shortly.');
    }
    if (Date.now() - rate.updatedAt.getTime() > this.maxAgeMs) {
      this.logger.error(`Exchange rate for ${this.currency} is stale (updated ${rate.updatedAt.toISOString()}) — refusing to create a provider payment`);
      throw new ApiException('PAYMENT_CURRENCY_UNAVAILABLE', 503, 'Card/PayPal payments are temporarily unavailable (exchange rate out of date). Please use bank transfer or try again shortly.');
    }

    const converted = toProviderAmount(amountPkr, rate.rateToPkr, this.currency);
    if (converted.amountMinor < 1) {
      throw new ApiException('PAYMENT_AMOUNT_TOO_SMALL', 422, 'This amount is too small to charge by card or PayPal. Please use bank transfer or credits.');
    }
    return { amountPkr, rateToPkr: rate.rateToPkr, ...converted };
  }
}
