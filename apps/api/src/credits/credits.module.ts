import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { CreditsAdminController } from './credits-admin.controller';
import { CreditsWebhooksController } from './credits-webhooks.controller';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

// docs/specs/2026-08-28-09-subscriptions-credits.md (aspect A-015b). Exports CreditsService for
// OrdersModule (checkout deduction/refund reversal) and SubscriptionsModule (monthly grants) — see
// PaymentsModule's doc comment for why the dependency runs this direction and not the reverse.
// NotificationsModule is @Global() (see its own doc comment) so NotificationService is injectable
// here without listing it in imports.
@Module({
  imports: [PaymentsModule],
  controllers: [CreditsController, CreditsAdminController, CreditsWebhooksController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
