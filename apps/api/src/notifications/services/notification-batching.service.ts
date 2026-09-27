import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CHANNELS } from '../notifications.constants';
import { NotificationEmailService } from './notification-email.service';
import { NotificationService } from './notification.service';

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
    private readonly notifications: NotificationService,
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
        recipientRole: recipient.role,
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
        recipientRole: admin.role,
      });
    }
  }

  // CZ_DIGITIZING_ARCHITECTURE.md § Notifications System, trigger 8 ("Subscription Renewal...
  // Delay: 1 day before expiry"). A-015 (Subscriptions & Credits) is now `Completed`
  // (SPEC_INDEX.md) and CustomerSubscription.renewalDate already carries exactly the data this
  // needs — the earlier TODO(A-015) blocker no longer applies. Routed through
  // NotificationService.notify() (not a raw email like the two digests above) so this reminder
  // gets a real Notification row too, not just an email. Dedup note: no separate
  // "reminder already sent" flag is needed — this cron runs once daily, and a fixed renewalDate
  // instant only ever falls inside a rolling [now, now+24h) window on one calendar day per cycle,
  // the same one-cron-per-day simplification sendOrderStatusDigest's own comment above documents.
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendSubscriptionRenewalReminders(): Promise<void> {
    const windowStart = new Date();
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
    const dueSoon = await this.prisma.customerSubscription.findMany({
      where: { status: 'active', autoRenew: true, renewalDate: { gte: windowStart, lt: windowEnd } },
      include: { plan: true },
    });

    for (const sub of dueSoon) {
      await this.notifications.notify({
        recipientUserId: sub.customerId.toString(),
        type: 'subscription_renewal',
        title: 'Your subscription renews tomorrow',
        message: `Your "${sub.plan.name}" subscription will renew on ${sub.renewalDate.toDateString()}.`,
        channels: DEFAULT_CHANNELS.subscription_renewal,
      });
    }
    if (dueSoon.length > 0) this.logger.log(`Sent ${dueSoon.length} subscription-renewal reminder(s)`);
  }
}
