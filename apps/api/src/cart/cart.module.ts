import { Module } from '@nestjs/common';
import { BundlesModule } from '../bundles/bundles.module';
import { CartCleanupService } from './cart-cleanup.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [BundlesModule],
  controllers: [CartController],
  providers: [CartService, CartCleanupService],
})
export class CartModule {}
