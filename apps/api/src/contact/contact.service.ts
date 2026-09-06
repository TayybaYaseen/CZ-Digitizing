import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateContactMessageDto } from './dto/create-contact-message.dto';

// SRS §15 (Contact Us, aspect A-010). No dedicated spec file — built directly from the SRS section
// plus the already-completed A-005a (Social & Contact Settings, PlatformSettings) and A-004
// (Notifications System) contracts, the same way A-009 Footer was.
@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async submit(dto: CreateContactMessageDto): Promise<void> {
    const row = await this.prisma.contactMessage.create({ data: dto });

    // Fan-out to every admin, same pattern as QuotesService.notifyAdmins() /
    // OrdersService's admin notification on new orders — contact_message is in
    // ADMIN_ONLY_TYPES (notifications.constants.ts), so this never reaches a customer inbox.
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'contact_message',
        title: 'New contact form submission',
        message: `${row.name} (${row.email}): ${row.message}`,
        channels: ['email', 'in_app'],
      });
    }
  }
}
