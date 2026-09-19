import { Module } from '@nestjs/common';
import { ExchangeRateService } from '../orders/exchange-rate.service';
import { PayPalService } from '../orders/payments/paypal.service';
import { StripeService } from '../orders/payments/stripe.service';
import { PaymentAmountService } from './payment-amount.service';

// Extracted out of OrdersModule so Subscriptions & Credits (A-015) can reuse the same one-time
// PayPal/Stripe capture flow for a plan's first payment / a credit-package purchase without
// creating a circular module dependency: OrdersModule itself needs CreditsModule (to deduct/reverse
// a customer's balance at checkout/refund), so Credits/Subscriptions can't depend back on
// OrdersModule for payments — this module is the shared leaf both sides import instead.
//
// ExchangeRateService lives here (not in OrdersModule) because PaymentAmountService — the one place
// a PKR amount becomes a provider amount — needs it, and every provider caller (orders, credits,
// subscriptions) must convert through that same service.
@Module({
  providers: [PayPalService, StripeService, ExchangeRateService, PaymentAmountService],
  exports: [PayPalService, StripeService, ExchangeRateService, PaymentAmountService],
})
export class PaymentsModule {}
