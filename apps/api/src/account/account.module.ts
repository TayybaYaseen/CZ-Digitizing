import { Module } from '@nestjs/common';
import { CustomRequestsModule } from '../custom-requests/custom-requests.module';
import { DesignsModule } from '../designs/designs.module';
import { OrdersModule } from '../orders/orders.module';
import { QuotesModule } from '../quotes/quotes.module';
import { AccountController } from './account.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { AccountService } from './account.service';

// docs/specs/2026-08-28-14-customer-account-history.md (aspect A-019). Imports the modules whose
// services it delegates to (OrdersModule/QuotesModule/CustomRequestsModule) plus DesignsModule for
// ImageUploadService's public-image storage (avatar upload reuses it rather than duplicating it).
@Module({
  imports: [OrdersModule, QuotesModule, CustomRequestsModule, DesignsModule],
  controllers: [AccountController, AdminCustomersController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
