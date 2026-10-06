import { Injectable, Logger } from '@nestjs/common';
import type { NotificationType } from '../generated/prisma';
import { ADMIN_NOTIFICATION_CHANNELS, DEFAULT_CHANNELS } from '../notifications/notifications.constants';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupportPresenceService } from './support-presence.service';
import { SupportStaffAccessService } from './support-staff-access.service';

export interface SupportNotificationContext {
  conversationId: bigint;
  customerId: bigint;
  customerName: string;
  contextLabel: string | null;
  preview: string;
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §17 — support_reply (to the customer) and
// support_message (to every permitted staff user), through the platform's NotificationService.
//
// §17.3 duplicate suppression — a recipient is skipped when they are (1) actively viewing the
// conversation, or (2) already have an UNREAD notification of that type for it. So a burst of
// messages produces at most one notification (and one email) per recipient until it is read.
//
// Runs after the message is committed and is never awaited by the request: a delivery failure is
// logged, not thrown (same posture as TaeboService.notifyAdminsWaiting). Work for one conversation is
// chained so two quick messages can't both pass the "no unread notification yet" check.
@Injectable()
export class SupportChatNotifierService {
  private readonly logger = new Logger(SupportChatNotifierService.name);
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly presence: SupportPresenceService,
    private readonly staffAccess: SupportStaffAccessService,
  ) {}

  customerWrote(ctx: SupportNotificationContext): Promise<void> {
    return this.enqueue(ctx.conversationId, async () => {
      const staff = await this.staffAccess.recipients();
      const context = ctx.contextLabel ? ` (${ctx.contextLabel})` : '';
      for (const member of staff) {
        await this.notifyOnce(member.id, 'support_message', ctx.conversationId, {
          title: `New support message from ${ctx.customerName}${context}`,
          message: ctx.preview,
          channels: ADMIN_NOTIFICATION_CHANNELS,
        });
      }
    });
  }

  supportReplied(ctx: SupportNotificationContext): Promise<void> {
    return this.enqueue(ctx.conversationId, () =>
      this.notifyOnce(ctx.customerId, 'support_reply', ctx.conversationId, {
        title: 'New reply from CZ Digitizing Support',
        message: ctx.preview,
        channels: DEFAULT_CHANNELS.support_reply,
      }),
    );
  }

  // Resolves once every queued notification for this conversation has been attempted (tests use it).
  async settled(conversationId: bigint): Promise<void> {
    await this.chains.get(conversationId.toString());
  }

  private async notifyOnce(
    recipientId: bigint,
    type: NotificationType,
    conversationId: bigint,
    content: { title: string; message: string; channels: (typeof ADMIN_NOTIFICATION_CHANNELS)[number][] },
  ): Promise<void> {
    try {
      if (this.presence.isViewing(conversationId.toString(), recipientId.toString())) return;
      const existing = await this.prisma.notification.findFirst({
        where: { recipientUserId: recipientId, notificationType: type, relatedSupportConversationId: conversationId, isRead: false },
        select: { id: true },
      });
      if (existing) return;
      await this.notifications.notify({
        recipientUserId: recipientId.toString(),
        type,
        title: content.title,
        message: content.message,
        relatedSupportConversationId: conversationId.toString(),
        channels: content.channels,
      });
    } catch (err) {
      this.logger.error(`Failed to send ${type} for support conversation ${conversationId} to user ${recipientId}: ${(err as Error).message}`);
    }
  }

  private enqueue(conversationId: bigint, work: () => Promise<void>): Promise<void> {
    const key = conversationId.toString();
    const previous = this.chains.get(key) ?? Promise.resolve();
    const next = previous.then(work, work).catch((err: Error) => this.logger.error(`Support notification chain failed: ${err.message}`));
    this.chains.set(key, next);
    void next.finally(() => {
      if (this.chains.get(key) === next) this.chains.delete(key);
    });
    return next;
  }
}
