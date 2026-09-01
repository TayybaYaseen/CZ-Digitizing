import { Injectable, Logger } from '@nestjs/common';
import type { Notification, NotificationChannel, User } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationEmailService } from './notification-email.service';
import { NotificationPushService } from './notification-push.service';
import { NotificationSmsService } from './notification-sms.service';
import { NotificationWhatsappService } from './notification-whatsapp.service';

// Fans a single Notification out to its resolved channels. Each channel is attempted
// independently via Promise.allSettled (not a sequential loop) — one slow/failing channel must
// never block or fail the others. Every attempt is recorded in NotificationDeliveryLog before and
// after, and dispatch() itself never throws back to the caller (NotificationService.notify()).
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: NotificationEmailService,
    private readonly whatsappService: NotificationWhatsappService,
    private readonly smsService: NotificationSmsService,
    private readonly pushService: NotificationPushService,
  ) {}

  // Returns per-channel success — NotificationService.notify() uses this to decide whether AC-10's
  // "SMS only if both email and WhatsApp are unreachable" fallback is actually warranted, since
  // that can only be known after attempting the other channels, not predicted ahead of time.
  async dispatchAll(notification: Notification, recipient: User, channels: NotificationChannel[]): Promise<Partial<Record<NotificationChannel, boolean>>> {
    // in_app has no external delivery step — the Notification row itself IS the in-app record.
    // Logging it here still gives AC-2/AC-3's "delivered to configured channel(s)" a uniform,
    // auditable delivery-log trail across every channel, not just the ones with a network call.
    const results = await Promise.allSettled(channels.map((channel) => this.dispatchOne(notification, recipient, channel)));
    const outcomes: Partial<Record<NotificationChannel, boolean>> = {};
    channels.forEach((channel, i) => {
      outcomes[channel] = results[i].status === 'fulfilled' ? results[i].value : false;
    });
    return outcomes;
  }

  private async dispatchOne(notification: Notification, recipient: User, channel: NotificationChannel): Promise<boolean> {
    const log = await this.prisma.notificationDeliveryLog.create({
      data: { notificationId: notification.id, channel, status: 'queued' },
    });

    try {
      const providerMessageId = await this.send(notification, recipient, channel);
      await this.prisma.notificationDeliveryLog.update({
        where: { id: log.id },
        data: { status: 'sent', providerMessageId },
      });
      return true;
    } catch (err) {
      this.logger.warn(`Notification ${notification.id} delivery failed on ${channel}: ${(err as Error).message}`);
      await this.prisma.notificationDeliveryLog.update({ where: { id: log.id }, data: { status: 'failed' } });
      return false;
    }
  }

  private async send(notification: Notification, recipient: User, channel: NotificationChannel): Promise<string | undefined> {
    switch (channel) {
      case 'in_app':
        return undefined; // the Notification row is the delivery
      case 'email':
        await this.emailService.send({
          to: recipient.email,
          userId: recipient.id,
          type: notification.notificationType,
          title: notification.title,
          message: notification.message,
        });
        return undefined;
      case 'whatsapp':
        if (!recipient.phone) throw new Error('recipient has no phone on file');
        return this.whatsappService.send({ to: recipient.phone, title: notification.title, message: notification.message });
      case 'sms':
        if (!recipient.phone) throw new Error('recipient has no phone on file');
        return this.smsService.send({ to: recipient.phone, title: notification.title, message: notification.message });
      case 'push':
        return this.pushService.send({ userId: recipient.id, title: notification.title, message: notification.message });
    }
  }
}
