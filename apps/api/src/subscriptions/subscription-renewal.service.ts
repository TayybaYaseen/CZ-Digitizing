import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

// AC-3/AC-8 — daily sweep for due renewals, same @nestjs/schedule cron pattern as
// notification-batching.service.ts's own daily jobs.
@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDueRenewals(): Promise<void> {
    const due = await this.prisma.customerSubscription.findMany({
      where: { status: 'active', autoRenew: true, renewalDate: { lte: new Date() } },
      include: { plan: true },
    });

    for (const sub of due) {
      try {
        await this.subscriptions.attemptRenewal(sub);
      } catch (err) {
        this.logger.error(`Renewal attempt failed for subscription ${sub.id}: ${(err as Error).message}`);
      }
    }
  }
}
