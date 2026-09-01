import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

// AC-3 — 30-day in-app retention for customer-facing notifications. Notification.expiresAt is
// set at insert time (NotificationService.notify()), so this sweep is a plain range delete, no
// join needed. Admin-only types have expiresAt = null and are never swept.
@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweepExpired(): Promise<void> {
    const result = await this.prisma.notification.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    if (result.count > 0) this.logger.log(`Retention sweep removed ${result.count} expired notification(s)`);
  }
}
