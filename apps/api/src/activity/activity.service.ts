import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { toActivityEventDto, type ActivityEventDto } from './dto/activity-event.dto';
import type { PagedResult } from '../designs/designs.service';

export interface RecordActivityInput {
  customerId: bigint;
  eventType: 'VIEWED' | 'ADDED_TO_CART' | 'REMOVED_FROM_CART' | 'PURCHASED' | 'PAID' | 'DOWNLOADED';
  designId?: bigint;
  orderId?: bigint;
  cartItemId?: string;
  fileId?: bigint;
  source: 'web' | 'mobile';
  idempotencyKey: string;
}

// docs/specs/2026-08-28-14-customer-account-history.md §3 (aspect A-019), AC-9–AC-15. The sole
// writer of activity_events — Cart/Orders/Private-File-Management call record() as a side effect
// of their own handlers (this spec owns the event, not the triggering business logic, per §3's
// "Internal contract" note).
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // AC-15 — idempotent on idempotencyKey's unique constraint: a retried call (duplicate webhook,
  // repeated view-session ping, a client's own retry-on-timeout) silently no-ops instead of
  // raising, since the caller's own action already succeeded and just wants the event recorded
  // once. Not wrapped in a SELECT-then-INSERT check — that has a race window this unique
  // constraint is specifically here to close.
  async record(input: RecordActivityInput): Promise<void> {
    try {
      await this.prisma.activityEvent.create({
        data: {
          customerId: input.customerId,
          eventType: input.eventType,
          designId: input.designId,
          orderId: input.orderId,
          cartItemId: input.cartItemId,
          fileId: input.fileId,
          source: input.source,
          idempotencyKey: input.idempotencyKey,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Duplicate activity event ignored (idempotencyKey=${input.idempotencyKey})`);
        return;
      }
      throw err;
    }
  }

  // AC-7 — a secondary member's activity feed reads the shared primary account's events, same
  // reasoning as AccountService.resolveEffectiveCustomerId (duplicated here, not imported from
  // AccountModule, to avoid a module cycle: AccountModule already imports OrdersModule, which
  // imports this module).
  async resolveEffectiveCustomerId(userId: bigint): Promise<bigint> {
    const membership = await this.prisma.accountMember.findFirst({ where: { memberUserId: userId, revokedAt: null } });
    return membership?.primaryUserId ?? userId;
  }

  async listForCustomer(customerId: bigint, page: number, pageSize: number): Promise<PagedResult<ActivityEventDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.activityEvent.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.activityEvent.count({ where: { customerId } }),
    ]);
    return { items: rows.map(toActivityEventDto), total };
  }
}
