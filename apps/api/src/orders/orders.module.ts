import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { BundlesModule } from '../bundles/bundles.module';
import { CreditsModule } from '../credits/credits.module';
import { FilesModule } from '../files/files.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013) — BANK TRANSFER ONLY: no
// provider module, no webhook controller. Exports OrdersService so CartModule can call
// OrdersService.createFromCart() from CartService.checkout(). Imports CreditsModule (checkout credit
// deduction / refund reversal / credit-package fulfilment) and SubscriptionsModule (subscription
// activation on receipt approval) — both one-directional: neither imports OrdersModule back (the
// routes that CREATE credit/subscription orders live in PurchasesModule, which sits above all three).
@Module({
  imports: [BundlesModule, FilesModule, PaymentsModule, CreditsModule, SubscriptionsModule, ActivityModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
