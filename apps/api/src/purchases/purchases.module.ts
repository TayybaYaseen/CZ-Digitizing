import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';

// Sits ABOVE OrdersModule, CreditsModule and SubscriptionsModule: it creates the bank-transfer orders
// for credit packages, subscription sign-ups and renewals (all through OrdersService), while
// OrdersModule itself depends on Credits/Subscriptions to fulfil them on receipt approval — keeping
// every module dependency one-directional.
@Module({
  imports: [OrdersModule, CreditsModule, SubscriptionsModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, SubscriptionRenewalService],
})
export class PurchasesModule {}
