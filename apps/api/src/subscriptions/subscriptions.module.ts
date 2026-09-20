import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { SubscriptionsAdminController } from './subscriptions-admin.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// docs/specs/2026-08-28-09-subscriptions-credits.md (aspect A-015a). Depends on CreditsModule (the
// monthly-grant side of AC-3/AC-8) — never the reverse. A subscription's first payment and every
// renewal are bank-transfer orders created by PurchasesModule; approving the receipt calls
// SubscriptionsService.activateFromOrder from OrdersService.
@Module({
  imports: [CreditsModule],
  controllers: [SubscriptionsController, SubscriptionsAdminController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
