import { Module } from '@nestjs/common';
import { BundlesModule } from '../bundles/bundles.module';
import { CreditsModule } from '../credits/credits.module';
import { FilesModule } from '../files/files.module';
import { PaymentsModule } from '../payments/payments.module';
import { ExchangeRateService } from './exchange-rate.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WebhooksController } from './webhooks.controller';

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013). Exports OrdersService so
// CartModule can call OrdersService.createFromCart() from CartService.checkout() — the same
// "service consumed by another feature module" shape as BundlesModule exporting BundlesService for
// CartModule's own bundle-pricing needs. Imports CreditsModule (not the other way around — see
// PaymentsModule's own doc comment) so checkout can deduct a customer's applied credits (AC-7,
// subscriptions-credits spec) and refund() can reverse them for real.
@Module({
  imports: [BundlesModule, FilesModule, PaymentsModule, CreditsModule],
  controllers: [OrdersController, WebhooksController],
  providers: [OrdersService, ExchangeRateService],
  exports: [OrdersService],
})
export class OrdersModule {}
