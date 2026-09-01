import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationEmailService } from './notification-email.service';

// docs/specs/2026-08-28-02-notifications-system.md §8 risk #3 — batching/scheduler mechanism.
// Uses @nestjs/schedule in-process cron, not a queue (see notification.service.ts's sibling
// decision on V1 sync dispatch — no broker exists yet, and this is the only other place a
// scheduler is genuinely needed). Known limitation: runs per-instance; fine for apps/api as a
// single instance today, revisit if horizontally scaled.
@Injectable()
export class NotificationBatchingService {
  private readonly logger = new Logger(NotificationBatchingService.name);
  private readonly registrationBatchEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: NotificationEmailService,
    config: ConfigService<Env, true>,
  ) {
    this.registrationBatchEnabled = config.get('NOTIFY_REGISTRATION_BATCH_ENABLED', { infer: true });
  }

  // Architecture's "5 min (batch)" cadence for order_status_change is an aggregation-interval
  // detail; its own "display" column already says "Daily summary email" — collapsed to one daily
  // job rather than a two-stage 5-min-aggregate-then-daily-send pipeline (flagged in the approved
  // implementation plan as a deliberate simplification, since it changes observable admin timing
  // versus a literal reading of "5 min").
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendOrderStatusDigest(): Promise<void> {
    const pending = await this.prisma.notification.findMany({
      where: { notificationType: 'order_status_change', batchedAt: null },
      include: { recipient: true },
    });
    if (pending.length === 0) return;

    const byAdmin = new Map<string, typeof pending>();
    for (const row of pending) {
      const key = row.recipientUserId.toString();
      byAdmin.set(key, [...(byAdmin.get(key) ?? []), row]);
    }

    for (const [, rows] of byAdmin) {
      const recipient = rows[0].recipient;
      const summary = rows.map((r) => `- ${r.title}`).join('\n');
      await this.emailService.send({
        to: recipient.email,
        userId: recipient.id,
        type: 'order_status_change',
        title: `Daily order status summary (${rows.length} update${rows.length === 1 ? '' : 's'})`,
        message: summary,
      });
    }

    await this.prisma.notification.updateMany({
      where: { id: { in: pending.map((r) => r.id) } },
      data: { batchedAt: new Date() },
    });
    this.logger.log(`Sent order-status digest to ${byAdmin.size} admin(s), ${pending.length} notification(s)`);
  }

  // Architecture: "(if enabled)" — off by default via NOTIFY_REGISTRATION_BATCH_ENABLED.
  @Cron(CronExpression.EVERY_HOUR)
  async sendRegistrationDigest(): Promise<void> {
    if (!this.registrationBatchEnabled) return;

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    const newCustomers = await this.prisma.user.count({ where: { role: 'customer', createdAt: { gte: since } } });
    if (newCustomers === 0) return;

    for (const admin of admins) {
      await this.emailService.send({
        to: admin.email,
        userId: admin.id,
        type: 'new_registration',
        title: `${newCustomers} new registration${newCustomers === 1 ? '' : 's'} in the last hour`,
        message: null,
      });
    }
  }

  // 1-day-before-expiry subscription reminder — genuinely blocked on A-015 (Subscriptions &
  // Credits), which hasn't created a Subscription model yet (docs/specs/SPEC_INDEX.md: A-015 is
  // `Blocked`). Stub with the same "not yet wired" seam pattern as NotificationPushService.
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendSubscriptionRenewalReminders(): Promise<void> {
    // TODO(A-015): query subscriptions expiring in 24h once the Subscription model exists, then
    // call NotificationService.notify() with type 'subscription_renewal' per subscriber.
  }
}
