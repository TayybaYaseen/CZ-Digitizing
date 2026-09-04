import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { SubscriptionsAdminController } from './subscriptions-admin.controller';
import { SubscriptionsWebhooksController } from './subscriptions-webhooks.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// docs/specs/2026-08-28-09-subscriptions-credits.md (aspect A-015a). Depends on CreditsModule (the
// monthly-grant side of AC-3/AC-8) and PaymentsModule (first-payment/renewal capture) — never the
// reverse, same one-directional shape as OrdersModule/CreditsModule (see PaymentsModule's comment).
@Module({
  imports: [PaymentsModule, CreditsModule],
  controllers: [SubscriptionsController, SubscriptionsAdminController, SubscriptionsWebhooksController],
  providers: [SubscriptionsService, SubscriptionRenewalService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
