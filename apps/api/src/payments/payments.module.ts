import { Module } from '@nestjs/common';
import { PayPalService } from '../orders/payments/paypal.service';
import { StripeService } from '../orders/payments/stripe.service';

// Extracted out of OrdersModule so Subscriptions & Credits (A-015) can reuse the same one-time
// PayPal/Stripe capture flow for a plan's first payment / a credit-package purchase without
// creating a circular module dependency: OrdersModule itself needs CreditsModule (to deduct/reverse
// a customer's balance at checkout/refund), so Credits/Subscriptions can't depend back on
// OrdersModule for payments — this module is the shared leaf both sides import instead.
@Module({
  providers: [PayPalService, StripeService],
  exports: [PayPalService, StripeService],
})
export class PaymentsModule {}
