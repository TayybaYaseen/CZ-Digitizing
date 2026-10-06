import { Module } from '@nestjs/common';
import { SupportChatAdminController } from './support-chat-admin.controller';
import { SupportChatEventsService } from './support-chat-events.service';
import { SupportChatNotifierService } from './support-chat-notifier.service';
import { SupportChatController } from './support-chat.controller';
import { SupportChatGateway } from './support-chat.gateway';
import { SupportChatService } from './support-chat.service';
import { SupportPresenceService } from './support-presence.service';
import { SupportStaffAccessService } from './support-staff-access.service';

// Customer ↔ Admin Live Chat (aspect A-025) — docs/specs/2026-10-06-21-customer-admin-live-chat.md.
// Prisma, Redis (rate limiter), Auth (TokenService), Audit and Notifications are all @Global modules.
@Module({
  controllers: [SupportChatController, SupportChatAdminController],
  providers: [
    SupportChatService,
    SupportChatEventsService,
    SupportChatNotifierService,
    SupportPresenceService,
    SupportStaffAccessService,
    SupportChatGateway,
  ],
})
export class SupportChatModule {}
