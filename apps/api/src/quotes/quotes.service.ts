import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { EmailService } from '../email/email.service';
import { StorageService } from '../files/storage.service';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Quote } from '../generated/prisma';
import { toQuoteDto, toQuoteMessageDto } from './dto/quote.dto';
import type { CreateQuoteDraftDto, CreateQuoteMessageDto, QuoteQueryDto, RespondQuoteDto, UpdateQuoteDraftDto } from './dto/quote-write.dto';
import { suggestQuotePricePkr } from './price-suggestion.util';

const REQUIRED_ON_SUBMIT = ['name', 'email', 'size', 'quantity'] as const;

// docs/specs/2026-08-28-11-smart-get-a-quote.md §3/§4 (aspect A-016).
@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
  ) {}

  // AC-9 foundation — created the moment a customer reaches Step 3, so the embedded chat has
  // something to attach to before the real submission (AC-4) happens.
  async createDraft(dto: CreateQuoteDraftDto, customerId?: string) {
    await this.assertServiceExists(dto.serviceId);
    let prefill: { name?: string; email?: string } = {};
    if (customerId) {
      const user = await this.prisma.user.findUnique({ where: { id: BigInt(customerId) } });
      if (user) prefill = { name: user.displayName ?? undefined, email: user.email };
    }
    const row = await this.prisma.quote.create({
      data: { serviceId: BigInt(dto.serviceId), customerId: customerId ? BigInt(customerId) : undefined, ...prefill },
    });
    return toQuoteDto(row, true);
  }

  async updateDraft(id: string, dto: UpdateQuoteDraftDto, access: QuoteAccess) {
    const quote = await this.findOrThrow(id);
    this.assertAccess(quote, access);
    if (quote.status !== 'draft') throw new ApiException('QUOTE_NOT_IN_DRAFT', 409, 'This quote has already been submitted');

    const row = await this.prisma.quote.update({
      where: { id: BigInt(id) },
      data: { ...dto, deadline: dto.deadline ? new Date(dto.deadline) : undefined },
    });
    return toQuoteDto(row, true);
  }

  // AC-4 — draft -> new. Fires quote_submitted (admin) + a submission-confirmation (customer).
  async submit(id: string, access: QuoteAccess, file?: Express.Multer.File) {
    const quote = await this.findOrThrow(id);
    this.assertAccess(quote, access);
    if (quote.status !== 'draft') throw new ApiException('QUOTE_NOT_IN_DRAFT', 409, 'This quote has already been submitted');

    const missing = REQUIRED_ON_SUBMIT.filter((field) => !quote[field]);
    if (missing.length > 0) {
      throw new ApiException('VALIDATION_ERROR', 400, `Missing required fields: ${missing.join(', ')}`, missing.map((field) => ({ field, message: 'required' })));
    }

    let designUploadPath: string | undefined;
    if (file) {
      const hash = this.storage.hashContent(file.buffer);
      designUploadPath = await this.storage.save(file.buffer, hash);
    }

    const row = await this.prisma.quote.update({
      where: { id: BigInt(id) },
      data: { status: 'new', designUploadPath },
    });

    await this.notifyAdmins(row, 'quote_submitted', 'New quote request', `A new quote request was submitted for review (Quote #${row.id}).`);
    await this.notifyCustomer(row, 'quote_submitted', 'We received your quote request', `Thanks — we received your quote request (#${row.id}) and will respond soon.`);

    await this.audit.record({ actionType: 'QUOTE_SUBMITTED', resourceType: 'quote', resourceId: id });
    return toQuoteDto(row, true);
  }

  async get(id: string, access: QuoteAccess) {
    const quote = await this.findOrThrow(id);
    this.assertAccess(quote, access);
    return toQuoteDto(quote, !!access.accessToken);
  }

  async listForCustomer(customerId: string) {
    const rows = await this.prisma.quote.findMany({ where: { customerId: BigInt(customerId), status: { not: 'draft' } }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => toQuoteDto(r));
  }

  async listForAdmin(query: QuoteQueryDto) {
    const rows = await this.prisma.quote.findMany({
      where: { status: query.status ?? { not: 'draft' } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toQuoteDto(r));
  }

  async listMessages(id: string, access: QuoteAccess) {
    const quote = await this.findOrThrow(id);
    this.assertAccess(quote, access);
    const rows = await this.prisma.quoteMessage.findMany({ where: { quoteId: BigInt(id) }, orderBy: { createdAt: 'asc' } });
    return rows.map(toQuoteMessageDto);
  }

  // AC-9 — customer-side messages use access, admin-side messages are role-gated at the controller.
  async addMessage(id: string, dto: CreateQuoteMessageDto, access: QuoteAccess, senderRole: 'customer' | 'admin') {
    const quote = await this.findOrThrow(id);
    this.assertAccess(quote, access);
    const row = await this.prisma.quoteMessage.create({ data: { quoteId: BigInt(id), senderRole, body: dto.body } });
    return toQuoteMessageDto(row);
  }

  // AC-8 — rule-based suggestion; Admin can accept or override it in respond().
  async suggestPrice(id: string, admin: AccessTokenPayload) {
    const quote = await this.findOrThrowWithService(id);
    const price = suggestQuotePricePkr({ serviceType: quote.service.type, quantity: quote.quantity, deadline: quote.deadline });
    const row = await this.prisma.quote.update({ where: { id: BigInt(id) }, data: { suggestedPricePkr: price } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'QUOTE_PRICE_SUGGESTED', resourceType: 'quote', resourceId: id, changes: { suggestedPricePkr: price } });
    return toQuoteDto(row);
  }

  // AC-6 — responded, sets admin_notes/quoted_price_pkr, notifies the customer (real account via
  // NotificationService, guest via direct email — NotificationService requires a real User.id).
  async respond(id: string, dto: RespondQuoteDto, admin: AccessTokenPayload) {
    const quote = await this.findOrThrow(id);
    if (quote.status === 'draft') throw new ApiException('QUOTE_NOT_IN_DRAFT', 409, 'Cannot respond to a draft quote');

    const row = await this.prisma.quote.update({
      where: { id: BigInt(id) },
      data: {
        status: 'responded',
        quotedPricePkr: dto.quotedPricePkr,
        adminNotes: dto.adminNotes,
        respondedByAdminId: BigInt(admin.sub),
        respondedAt: new Date(),
      },
    });

    const message = `We've responded to your quote request (#${row.id}) — quoted price: PKR ${dto.quotedPricePkr}.`;
    await this.notifyCustomer(row, 'quote_response', 'Your quote is ready', message);

    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'QUOTE_RESPONDED', resourceType: 'quote', resourceId: id, changes: { quotedPricePkr: dto.quotedPricePkr } });
    return toQuoteDto(row);
  }

  private async assertServiceExists(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: BigInt(serviceId) } });
    if (!service) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Service not found');
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.quote.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Quote not found');
    return row;
  }

  private async findOrThrowWithService(id: string) {
    const row = await this.prisma.quote.findUnique({ where: { id: BigInt(id) }, include: { service: true } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Quote not found');
    return row;
  }

  // AC-9's draft-access-token invariant + owner/admin fallback for everything else.
  private assertAccess(quote: Quote, access: QuoteAccess) {
    if (access.isStaff) return;
    if (access.customerId && quote.customerId && access.customerId === quote.customerId.toString()) return;
    if (access.accessToken && access.accessToken === quote.accessToken) return;
    throw new ApiException('FORBIDDEN', 403, 'You do not have access to this quote');
  }

  private async notifyAdmins(quote: Quote, type: 'quote_submitted', title: string, message: string) {
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({ recipientUserId: admin.id.toString(), type, title, message, relatedQuoteId: quote.id.toString(), channels: ['email', 'in_app'] });
    }
  }

  private async notifyCustomer(quote: Quote, type: 'quote_submitted' | 'quote_response', title: string, message: string) {
    if (quote.customerId) {
      await this.notifications.notify({ recipientUserId: quote.customerId.toString(), type, title, message, relatedQuoteId: quote.id.toString(), channels: ['email', 'in_app'] });
    } else if (quote.email) {
      await this.email.send({ to: quote.email, subject: title, text: message });
    }
  }
}

// AC-9's draft-access-token + owner/admin access control, shared by every route that touches a
// single quote (draft PATCH/submit/messages/get).
export interface QuoteAccess {
  isStaff: boolean;
  customerId?: string;
  accessToken?: string;
}
