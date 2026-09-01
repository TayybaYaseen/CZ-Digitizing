import { Global, Module } from '@nestjs/common';
import { NotificationsAdminController } from './notifications-admin.controller';
import { NotificationsCustomerController } from './notifications-customer.controller';
import { NotificationBatchingService } from './services/notification-batching.service';
import { NotificationCleanupService } from './services/notification-cleanup.service';
import { NotificationDispatchService } from './services/notification-dispatch.service';
import { NotificationEmailService } from './services/notification-email.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationPushService } from './services/notification-push.service';
import { NotificationSmsService } from './services/notification-sms.service';
import { NotificationWhatsappService } from './services/notification-whatsapp.service';
import { NotificationService } from './services/notification.service';

// @Global() like AuthModule/EmailModule — every other feature module (orders, quotes, custom
// requests, Taebo, subscriptions, auth's own new-device-login path) needs to inject
// NotificationService without importing this module explicitly.
@Global()
@Module({
  controllers: [NotificationsAdminController, NotificationsCustomerController],
  providers: [
    NotificationService,
    NotificationDispatchService,
    NotificationEmailService,
    NotificationWhatsappService,
    NotificationPushService,
    NotificationSmsService,
    NotificationPreferenceService,
    NotificationBatchingService,
    NotificationCleanupService,
  ],
  exports: [NotificationService, NotificationPreferenceService],
})
export class NotificationsModule {}
