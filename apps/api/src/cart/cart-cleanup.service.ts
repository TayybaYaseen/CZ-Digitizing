import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — spec §4's own suggested figure

// docs/specs/2026-08-28-07-shopping-cart-checkout.md §4 (aspect A-011) — guest carts (never
// customer carts, which persist indefinitely per AC-1) expire after 30 days of inactivity.
// Cart.updatedAt is bumped by CartService.touch() on every item mutation, so this sweep is a
// plain range delete, no join needed — mirrors NotificationCleanupService's retention sweep.
@Injectable()
export class CartCleanupService {
  private readonly logger = new Logger(CartCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweepStaleGuestCarts(): Promise<void> {
    const result = await this.prisma.cart.deleteMany({
      where: { customerId: null, updatedAt: { lt: new Date(Date.now() - GUEST_CART_TTL_MS) } },
    });
    if (result.count > 0) this.logger.log(`Guest-cart sweep removed ${result.count} inactive cart(s)`);
  }
}
