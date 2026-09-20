import { Module } from '@nestjs/common';
import { ExchangeRateService } from '../orders/exchange-rate.service';

// Bank transfer is the only payment method (A-013, spec §11), so this module no longer wraps any
// payment provider. It only provides ExchangeRateService — the hourly-refreshed PKR rates behind the
// DISPLAY-ONLY local-currency amount (AC-8). No payment is ever priced or charged through it: what a
// customer transfers is always the exact PKR amount due.
@Module({
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class PaymentsModule {}
