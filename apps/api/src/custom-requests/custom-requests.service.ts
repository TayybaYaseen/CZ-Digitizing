import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import type { CustomRequestStatus } from '../generated/prisma';
import { StorageService } from '../files/storage.service';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertValidCustomRequestTransition, InvalidCustomRequestTransitionError } from './custom-request-state-machine';
import { toCustomRequestDto, toCustomRequestMessageDto, toCustomRequestSummaryDto, type CustomRequestWithRelations } from './dto/custom-request.dto';
import type { CreateCustomRequestDto, CreateCustomRequestMessageDto, CustomRequestQueryDto, SendQuoteDto, UpdateCustomRequestDto } from './dto/custom-request-write.dto';
import { pickLeastLoadedDesigner } from './designer-assignment.util';
import { generateCustomRequestNumber } from './request-number.util';

const INCLUDE = { customer: true, designer: true, references: true, files: true } as const;
// AC-9's designer-workload balancer only ever picks among freelancers — admins/moderators manage
// the queue, they don't personally produce every request.
const DESIGNER_ROLE = 'freelancer';
// A custom request counts against a designer's workload while it's actively being worked, not
// once it's delivered/completed/cancelled.
const ACTIVE_DESIGNER_STATUSES: CustomRequestStatus[] = ['approved', 'in_production', 'revision_required'];

// docs/specs/2026-08-28-12-custom-design-requests.md §3/§4 (aspect A-017).
@Injectable()
export class CustomRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationService,
    private readonly storage: StorageService,
  ) {}

  // AC-1 — customer_id is NOT NULL in the architecture DDL (unlike Quote's guest posture), so this
  // always runs for a real, authenticated customer account.
  async create(dto: CreateCustomRequestDto, customerId: string, mainImage?: Express.Multer.File, referenceImages: Express.Multer.File[] = []) {
    let imageUrl: string | undefined;
    if (mainImage) {
      const hash = this.storage.hashContent(mainImage.buffer);
      imageUrl = await this.storage.save(mainImage.buffer, hash);
    }

    const row = await this.prisma.customRequest.create({
      data: {
        requestNumber: generateCustomRequestNumber(),
        customerId: BigInt(customerId),
        requestType: dto.requestType,
        sizeValue: dto.sizeValue,
        machineFormat: dto.machineFormat,
        fabricType: dto.fabricType,
        specialInstructions: dto.specialInstructions,
        imageUrl,
        references: { create: await this.saveReferences(referenceImages) },
      },
      include: INCLUDE,
    });

    await this.notifyAdmins(row, 'New custom design request', `A new custom design request (#${row.requestNumber}) was submitted for review.`);
    await this.audit.record({ actionType: 'CUSTOM_REQUEST_SUBMITTED', resourceType: 'custom_request', resourceId: row.id.toString() });
    return toCustomRequestDto(row);
  }

  async addReferences(id: string, customerId: string, files: Express.Multer.File[]) {
    const request = await this.findOwnedOrThrow(id, customerId);
    const saved = await this.saveReferences(files);
    await this.prisma.customRequestReference.createMany({ data: saved.map((r) => ({ ...r, customRequestId: request.id })) });
    return this.getForAdmin(id);
  }

  async getForCustomer(id: string, customerId: string) {
    const row = await this.findOwnedOrThrow(id, customerId);
    return toCustomRequestDto(row as unknown as CustomRequestWithRelations);
  }

  async getForAdmin(id: string) {
    const row = await this.findOrThrow(id);
    return toCustomRequestDto(row);
  }

  async listForCustomer(customerId: string, page: number, pageSize: number) {
    const where = { customerId: BigInt(customerId) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.customRequest.count({ where }),
    ]);
    return { items: rows.map(toCustomRequestSummaryDto), total };
  }

  async listForAdmin(query: CustomRequestQueryDto) {
    const where = { ...(query.status ? { status: query.status } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customRequest.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.customRequest.count({ where }),
    ]);
    return { items: rows.map(toCustomRequestDto), total };
  }

  // AC-2/AC-3/AC-7 — admin status/assignment/notes changes. Auto-assigns the least-loaded
  // freelancer (AC-9) when the request first enters `reviewing` with no designer already set.
  async update(id: string, dto: UpdateCustomRequestDto, admin: AccessTokenPayload) {
    const request = await this.findOrThrow(id);
    const data: { status?: CustomRequestStatus; designerId?: bigint; adminNotes?: string } = {};

    if (dto.status && dto.status !== request.status) {
      try {
        assertValidCustomRequestTransition(request.status, dto.status);
      } catch (err) {
        if (err instanceof InvalidCustomRequestTransitionError) {
          throw new ApiException('INVALID_CUSTOM_REQUEST_TRANSITION', 409, err.message);
        }
        throw err;
      }
      data.status = dto.status;
    }
    if (dto.designerId) data.designerId = BigInt(dto.designerId);
    if (dto.adminNotes !== undefined) data.adminNotes = dto.adminNotes;

    if (data.status === 'reviewing' && !request.designerId && !data.designerId) {
      const autoAssigned = await this.autoAssignDesigner();
      if (autoAssigned) data.designerId = BigInt(autoAssigned);
    }

    const updated = await this.prisma.customRequest.update({ where: { id: request.id }, data, include: INCLUDE });

    if (data.status) {
      await this.notifyCustomer(updated, 'Custom request status updated', `Your custom request #${updated.requestNumber} is now "${data.status}".`);
    }
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'CUSTOM_REQUEST_UPDATED', resourceType: 'custom_request', resourceId: id, changes: { ...dto } });
    return toCustomRequestDto(updated);
  }

  // AC-4 — Admin sends a quote: reviewing -> quote_sent.
  async sendQuote(id: string, dto: SendQuoteDto, admin: AccessTokenPayload) {
    const request = await this.findOrThrow(id);
    try {
      assertValidCustomRequestTransition(request.status, 'quote_sent');
    } catch (err) {
      if (err instanceof InvalidCustomRequestTransitionError) throw new ApiException('INVALID_CUSTOM_REQUEST_TRANSITION', 409, err.message);
      throw err;
    }

    const updated = await this.prisma.customRequest.update({
      where: { id: request.id },
      data: { status: 'quote_sent', quotedPricePkr: dto.quotedPricePkr, adminNotes: dto.adminNotes ?? request.adminNotes },
      include: INCLUDE,
    });

    await this.notifyCustomer(updated, 'Your custom request quote is ready', `We've sent a quote for your custom request #${updated.requestNumber} — PKR ${dto.quotedPricePkr}.`);
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'CUSTOM_REQUEST_QUOTE_SENT', resourceType: 'custom_request', resourceId: id, changes: { quotedPricePkr: dto.quotedPricePkr } });
    return toCustomRequestDto(updated);
  }

  async listMessages(id: string, requesterId: string, isStaff: boolean) {
    const request = isStaff ? await this.findOrThrow(id) : await this.findOwnedOrThrow(id, requesterId);
    const rows = await this.prisma.customRequestMessage.findMany({ where: { customRequestId: request.id }, include: { sender: true }, orderBy: { createdAt: 'asc' } });
    return rows.map(toCustomRequestMessageDto);
  }

  // AC-8 — persists the message; the WebSocket gateway (custom-requests.gateway.ts) separately
  // broadcasts it live plus the typing indicator, neither of which is persisted state.
  async addMessage(id: string, dto: CreateCustomRequestMessageDto, senderUserId: string, isStaff: boolean) {
    const request = isStaff ? await this.findOrThrow(id) : await this.findOwnedOrThrow(id, senderUserId);
    const row = await this.prisma.customRequestMessage.create({
      data: { customRequestId: request.id, senderUserId: BigInt(senderUserId), message: dto.message },
      include: { sender: true },
    });
    return toCustomRequestMessageDto(row);
  }

  private async saveReferences(files: Express.Multer.File[]): Promise<{ imageUrl: string }[]> {
    const created: { imageUrl: string }[] = [];
    for (const file of files) {
      const hash = this.storage.hashContent(file.buffer);
      const imageUrl = await this.storage.save(file.buffer, hash);
      created.push({ imageUrl });
    }
    return created;
  }

  // AC-9 — picks the freelancer with the fewest currently-active custom requests.
  private async autoAssignDesigner(): Promise<string | null> {
    const designers = await this.prisma.user.findMany({ where: { role: DESIGNER_ROLE, status: 'active' } });
    if (designers.length === 0) return null;
    const counts = await this.prisma.customRequest.groupBy({
      by: ['designerId'],
      where: { designerId: { in: designers.map((d) => d.id) }, status: { in: ACTIVE_DESIGNER_STATUSES } },
      _count: { _all: true },
    });
    const countByDesigner = new Map(counts.map((c) => [c.designerId!.toString(), c._count._all]));
    return pickLeastLoadedDesigner(designers.map((d) => ({ designerId: d.id.toString(), activeRequestCount: countByDesigner.get(d.id.toString()) ?? 0 })));
  }

  private async findOrThrow(id: string): Promise<CustomRequestWithRelations> {
    const row = await this.prisma.customRequest.findUnique({ where: { id: BigInt(id) }, include: INCLUDE });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Custom request not found');
    return row;
  }

  private async findOwnedOrThrow(id: string, customerId: string): Promise<CustomRequestWithRelations> {
    const row = await this.prisma.customRequest.findFirst({ where: { id: BigInt(id), customerId: BigInt(customerId) }, include: INCLUDE });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Custom request not found');
    return row;
  }

  private async notifyAdmins(request: CustomRequestWithRelations, title: string, message: string) {
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({ recipientUserId: admin.id.toString(), type: 'custom_request_status_update', title, message, relatedCustomRequestId: request.id.toString(), channels: ['email', 'in_app'] });
    }
  }

  private async notifyCustomer(request: CustomRequestWithRelations, title: string, message: string) {
    await this.notifications.notify({ recipientUserId: request.customerId.toString(), type: 'custom_request_status_update', title, message, relatedCustomRequestId: request.id.toString(), channels: ['email', 'in_app'] });
  }
}
