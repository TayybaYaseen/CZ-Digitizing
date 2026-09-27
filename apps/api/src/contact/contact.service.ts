import { Injectable } from '@nestjs/common';
import type { ContactMessageDto } from '@czd/shared-types';
import type { ContactMessage } from '../generated/prisma';
import { ApiException } from '../common/exceptions/api-exception';
import { DEFAULT_CHANNELS } from '../notifications/notifications.constants';
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
        relatedContactMessageId: row.id.toString(),
        channels: DEFAULT_CHANNELS.contact_message,
      });
    }
  }

  // Admin inbox — newest first, same ApiResponse<T[]> + meta paging as the notification lists.
  async list(page: number, pageSize: number): Promise<{ items: ContactMessageDto[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.contactMessage.count(),
    ]);
    return { items: rows.map(toContactMessageDto), total };
  }

  async get(id: string): Promise<ContactMessageDto> {
    // A non-numeric id would make BigInt() throw a 500 (which itself fires a system_alert).
    const row = /^\d+$/.test(id) ? await this.prisma.contactMessage.findUnique({ where: { id: BigInt(id) } }) : null;
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Contact message not found');
    return toContactMessageDto(row);
  }
}

function toContactMessageDto(row: ContactMessage): ContactMessageDto {
  return { id: row.id.toString(), name: row.name, email: row.email, message: row.message, createdAt: row.createdAt.toISOString() };
}
