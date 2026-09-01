import { Injectable } from '@nestjs/common';
import type { NotificationDto } from '@czd/shared-types';
import type { NotificationChannel, NotificationType, User } from '../../generated/prisma';
import { ApiException } from '../../common/exceptions/api-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { toNotificationDto } from '../dto/notification.mapper';
import { ADMIN_ONLY_TYPES, CUSTOMER_RETENTION_DAYS, SMS_ELIGIBLE_TYPES, WHATSAPP_FALLBACK_WINDOW_HOURS } from '../notifications.constants';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationPreferenceService } from './notification-preference.service';

export interface NotifyInput {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedOrderId?: string;
  relatedQuoteId?: string;
  relatedCustomRequestId?: string;
  channels: NotificationChannel[];
}

export interface NotificationListResult {
  items: NotificationDto[];
  total: number;
}

// docs/specs/2026-08-28-02-notifications-system.md §3 — the internal contract every other feature
// module calls into instead of implementing its own ad-hoc email/WhatsApp sending.
//
// Do not call notify() from routine FAQ-suggestion-click handlers (smart-get-a-quote.md AC-2/AC-4,
// this spec's AC-4) — only from an actual quote submission/response or another real trigger.
@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferenceService,
    private readonly dispatch: NotificationDispatchService,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const userId = BigInt(input.recipientUserId);
    const recipient = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // 'sms' is never part of a normal dispatch (see notifications.constants.ts) — it's added only
    // as a last-resort fallback below, after seeing whether email/WhatsApp actually succeeded.
    let channels = (await this.preferences.resolveEnabledChannels(userId, input.type, input.channels)).filter((c) => c !== 'sms');

    // AC-6 — WhatsApp requires a recent inbound message; otherwise fall back to email/in-app
    // instead of silently failing. This overrides a per-user email/in_app opt-out specifically in
    // this reachability scenario (a technical constraint, not a preference choice) — those two
    // channels are already part of every WhatsApp-eligible type's default routing set, so this is
    // never an expansion beyond the platform's own table, only a reachability-driven override of
    // an opt-out for this one delivery.
    const whatsappRequested = channels.includes('whatsapp');
    if (whatsappRequested && !this.isWhatsappReachable(recipient)) {
      channels = channels.filter((c) => c !== 'whatsapp');
      for (const fallback of ['email', 'in_app'] as const) {
        if (!channels.includes(fallback)) channels.push(fallback);
      }
    }

    const isCustomerFacing = !ADMIN_ONLY_TYPES.includes(input.type);
    const notification = await this.prisma.notification.create({
      data: {
        recipientUserId: userId,
        notificationType: input.type,
        title: input.title,
        message: input.message,
        relatedOrderId: input.relatedOrderId ? BigInt(input.relatedOrderId) : undefined,
        relatedQuoteId: input.relatedQuoteId ? BigInt(input.relatedQuoteId) : undefined,
        relatedCustomRequestId: input.relatedCustomRequestId ? BigInt(input.relatedCustomRequestId) : undefined,
        expiresAt: isCustomerFacing ? addDays(new Date(), CUSTOMER_RETENTION_DAYS) : null,
      },
    });

    const outcomes = await this.dispatch.dispatchAll(notification, recipient, channels);

    // AC-10 — SMS fires only once both WhatsApp (never attempted here, or attempted and failed)
    // and email (attempted and failed) leave the customer unreachable — never sent blanket
    // alongside them. "email"/"whatsapp" absent from `outcomes` (excluded above, or never
    // requested) counts the same as a failed attempt for this purpose.
    if (SMS_ELIGIBLE_TYPES.includes(input.type) && recipient.phone && outcomes.email !== true && outcomes.whatsapp !== true) {
      const smsChannel = await this.preferences.resolveEnabledChannels(userId, input.type, ['sms']);
      if (smsChannel.length > 0) {
        await this.dispatch.dispatchAll(notification, recipient, ['sms']);
      }
    }
  }

  private isWhatsappReachable(recipient: User): boolean {
    if (!recipient.lastWhatsappInboundAt) return false;
    const hoursSinceLastMessage = (Date.now() - recipient.lastWhatsappInboundAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMessage <= WHATSAPP_FALLBACK_WINDOW_HOURS;
  }

  // Shared by both the admin and customer controllers — every notification route is scoped to
  // the calling user's own recipientUserId; the admin route differs only in its @Roles gate.
  async list(userId: bigint, page: number, pageSize: number, isRead?: boolean): Promise<NotificationListResult> {
    const where = { recipientUserId: userId, ...(isRead !== undefined ? { isRead } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.notification.count({ where }),
    ]);
    return { items: rows.map(toNotificationDto), total };
  }

  async unreadCount(userId: bigint): Promise<number> {
    return this.prisma.notification.count({ where: { recipientUserId: userId, isRead: false } });
  }

  // AC-8 — marking read never touches the underlying business record (order/quote/etc.); this
  // only ever writes to the Notification row itself.
  async markRead(userId: bigint, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id: BigInt(id), recipientUserId: userId },
      data: { isRead: true, readAt: new Date() },
    });
    if (result.count === 0) throw new ApiException('NOTIFICATION_NOT_FOUND', 404, 'Notification not found');
  }

  async remove(userId: bigint, id: string): Promise<void> {
    const result = await this.prisma.notification.deleteMany({ where: { id: BigInt(id), recipientUserId: userId } });
    if (result.count === 0) throw new ApiException('NOTIFICATION_NOT_FOUND', 404, 'Notification not found');
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
