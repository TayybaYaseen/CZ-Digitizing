import type { NotificationDto } from '@czd/shared-types';
import type { Notification } from '../../generated/prisma';

// Never return a raw Prisma `Notification` row — stringifies bigint ids/FKs, which
// JSON.stringify can't serialize natively (mirrors apps/api/src/auth/dto/user-profile.dto.ts).
export function toNotificationDto(notification: Notification): NotificationDto {
  return {
    id: notification.id.toString(),
    notificationType: notification.notificationType,
    title: notification.title,
    message: notification.message,
    relatedOrderId: notification.relatedOrderId?.toString() ?? null,
    relatedQuoteId: notification.relatedQuoteId?.toString() ?? null,
    relatedCustomRequestId: notification.relatedCustomRequestId?.toString() ?? null,
    isRead: notification.isRead,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}
