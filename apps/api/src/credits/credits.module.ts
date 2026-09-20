import { Module } from '@nestjs/common';
import { CreditsAdminController } from './credits-admin.controller';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

// docs/specs/2026-08-28-09-subscriptions-credits.md (aspect A-015b). Exports CreditsService for
// OrdersModule (checkout deduction / refund reversal / credit-package fulfilment) and
// SubscriptionsModule (monthly grants). Buying credits is a bank-transfer order created by
// PurchasesModule. NotificationsModule is @Global() (see its own doc comment) so NotificationService
// is injectable here without listing it in imports.
@Module({
  controllers: [CreditsController, CreditsAdminController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
