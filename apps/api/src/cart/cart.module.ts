import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { BundlesModule } from '../bundles/bundles.module';
import { CreditsModule } from '../credits/credits.module';
import { OrdersModule } from '../orders/orders.module';
import { CartCleanupService } from './cart-cleanup.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [BundlesModule, OrdersModule, CreditsModule, ActivityModule],
  controllers: [CartController],
  providers: [CartService, CartCleanupService],
})
export class CartModule {}
