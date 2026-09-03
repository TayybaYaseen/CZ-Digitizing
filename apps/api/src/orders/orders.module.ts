import { Module } from '@nestjs/common';
import { BundlesModule } from '../bundles/bundles.module';
import { FilesModule } from '../files/files.module';
import { ExchangeRateService } from './exchange-rate.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PayPalService } from './payments/paypal.service';
import { StripeService } from './payments/stripe.service';
import { WebhooksController } from './webhooks.controller';

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013). Exports OrdersService so
// CartModule can call OrdersService.createFromCart() from CartService.checkout() — the same
// "service consumed by another feature module" shape as BundlesModule exporting BundlesService for
// CartModule's own bundle-pricing needs.
@Module({
  imports: [BundlesModule, FilesModule],
  controllers: [OrdersController, WebhooksController],
  providers: [OrdersService, ExchangeRateService, PayPalService, StripeService],
  exports: [OrdersService],
})
export class OrdersModule {}
