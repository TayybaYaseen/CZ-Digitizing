import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminSupportConversationDto,
  AdminSupportConversationSummaryDto,
  AdminSupportMessageDto,
  AdminSupportReadResult,
  StartSupportConversationResult,
  SupportContextCardDto,
  SupportContextType,
  SupportConversationDto,
  SupportConversationStatus,
  SupportConversationSummaryDto,
  SupportCustomerInfoDto,
  SupportMessageDto,
  SupportReadResult,
} from '@czd/shared-types';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { RateLimiterService } from '../common/rate-limit/rate-limiter.service';
import { Prisma, type SupportSenderType } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  displayNameOf,
  SUPPORT_CONVERSATION_INCLUDE,
  SUPPORT_MESSAGE_INCLUDE,
  toAdminMessageDto,
  toAdminSummaryDto,
  toContextRef,
  toCustomerConversationDto,
  toCustomerMessageDto,
  toCustomerSummaryDto,
  type SupportConversationRow,
  type SupportMessageRow,
} from './dto/support-chat.mapper';
import type {
  SendSupportMessageDto,
  StartSupportConversationDto,
  SupportAdminListQueryDto,
  SupportCustomerListQueryDto,
  SupportMessagesQueryDto,
} from './dto/support-chat-write.dto';
import { SupportChatEventsService } from './support-chat-events.service';
import { SupportChatNotifierService } from './support-chat-notifier.service';
import { ADMIN_SEND_LIMIT, CUSTOMER_SEND_LIMIT, CUSTOMER_START_LIMIT } from './support-chat.constants';
import { normalizeSupportMessageBody, supportMessagePreview } from './support-message.util';

type Tx = Prisma.TransactionClient;
type Side = 'customer' | 'admin';

export interface MessagePage<T> {
  items: T[];
  hasMore: boolean;
}

interface AppendResult {
  conversation: SupportConversationRow;
  message: SupportMessageRow;
  duplicate: boolean;
}

const CONTEXT_FK: Record<Exclude<SupportContextType, 'general'>, 'orderId' | 'customRequestId' | 'quoteId' | 'fileFormatRequestId'> = {
  order: 'orderId',
  custom_request: 'customRequestId',
  quote: 'quoteId',
  file_format_request: 'fileFormatRequestId',
};

const STATUS_LABEL: Record<SupportConversationStatus, string> = { open: 'Open', pending: 'Pending', resolved: 'Resolved' };

// docs/specs/2026-10-06-21-customer-admin-live-chat.md (aspect A-025). Every write goes through here
// over REST (§11.1); the socket gateway only relays pushes this service emits after commit.
//
// Isolation rule (§28.1): every customer read/write puts `customerId = <JWT sub>` in the SAME query
// as the conversation id, and "not yours" is the same 404 as "doesn't exist".
@Injectable()
export class SupportChatService {
  private readonly logger = new Logger(SupportChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: SupportChatEventsService,
    private readonly notifier: SupportChatNotifierService,
    private readonly audit: AuditLogService,
    private readonly limiter: RateLimiterService,
  ) {}

  // ======================================================================================
  // Customer side
  // ======================================================================================

  async listForCustomer(user: AccessTokenPayload, query: SupportCustomerListQueryDto): Promise<{ items: SupportConversationSummaryDto[]; total: number }> {
    const where: Prisma.SupportConversationWhereInput = { customerId: BigInt(user.sub) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supportConversation.findMany({
        where,
        include: SUPPORT_CONVERSATION_INCLUDE,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supportConversation.count({ where }),
    ]);
    return { items: rows.map(toCustomerSummaryDto), total };
  }

  async getForCustomer(user: AccessTokenPayload, id: bigint): Promise<SupportConversationDto> {
    return toCustomerConversationDto(await this.findOwnedOr404(user, id));
  }

  // Throws the same 404 for "doesn't exist" and "not yours" — also used by the gateway's join check.
  async findOwnedOr404(user: Pick<AccessTokenPayload, 'sub'>, id: bigint): Promise<SupportConversationRow> {
    const row = await this.prisma.supportConversation.findFirst({ where: { id, customerId: BigInt(user.sub) }, include: SUPPORT_CONVERSATION_INCLUDE });
    if (!row) throw notFound();
    return row;
  }

  // §13.3 — idempotent: reuses the customer's active conversation for the same context.
  async start(user: AccessTokenPayload, dto: StartSupportConversationDto): Promise<StartSupportConversationResult> {
    const customerId = BigInt(user.sub);
    await this.assertCustomerCanSend(customerId);
    const body = this.normalizeOrThrow(dto.body);
    const contextType = dto.contextType ?? 'general';
    const contextFk = await this.resolveOwnedContext(customerId, contextType, dto.contextId);

    // A retried start (same clientMessageId) returns the original result, whatever happened since.
    const replay = await this.findMessageByClientId(customerId, dto.clientMessageId);
    if (replay) return this.startResult(replay.conversation, replay.message, false);

    await this.limiter.consume(`support:start:${customerId}`, CUSTOMER_START_LIMIT.limit, CUSTOMER_START_LIMIT.windowSeconds);

    const activeWhere: Prisma.SupportConversationWhereInput = {
      customerId,
      contextType,
      status: { not: 'resolved' },
      ...(contextFk ? { [contextFk.field]: contextFk.id } : {}),
    };

    let result: AppendResult & { created: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.supportConversation.findFirst({ where: activeWhere, select: { id: true } });
        const conversationId =
          existing?.id ??
          (
            await tx.supportConversation.create({
              data: { customerId, contextType, status: 'open', ...(contextFk ? { [contextFk.field]: contextFk.id } : {}) },
              select: { id: true },
            })
          ).id;
        const appended = await this.appendInTx(tx, conversationId, 'customer', customerId, body, dto.clientMessageId);
        return { ...appended, created: !existing };
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Lost a race: either a concurrent start created the active conversation, or this exact
      // clientMessageId was just stored by a parallel retry. Both resolve to the stored state.
      const stored = await this.findMessageByClientId(customerId, dto.clientMessageId);
      if (stored) return this.startResult(stored.conversation, stored.message, false);
      const active = await this.prisma.supportConversation.findFirst({ where: activeWhere, select: { id: true } });
      if (!active) throw err;
      result = { ...(await this.appendInTransaction(active.id, 'customer', customerId, body, dto.clientMessageId)), created: false };
    }

    this.afterAppend(result);
    return this.startResult(result.conversation, result.message, result.created);
  }

  async listMessagesForCustomer(user: AccessTokenPayload, id: bigint, query: SupportMessagesQueryDto): Promise<MessagePage<SupportMessageDto>> {
    await this.findOwnedOr404(user, id);
    const page = await this.pageMessages(id, query, false);
    return { items: page.items.map(toCustomerMessageDto), hasMore: page.hasMore };
  }

  async sendAsCustomer(user: AccessTokenPayload, id: bigint, dto: SendSupportMessageDto): Promise<{ message: SupportMessageDto; duplicate: boolean }> {
    const customerId = BigInt(user.sub);
    const conversation = await this.findOwnedOr404(user, id);
    await this.assertCustomerCanSend(customerId);
    const body = this.normalizeOrThrow(dto.body);
    await this.limiter.consume(`support:send:customer:${customerId}`, CUSTOMER_SEND_LIMIT.limit, CUSTOMER_SEND_LIMIT.windowSeconds);

    const result = await this.appendOrResolveConflict(conversation, 'customer', customerId, body, dto.clientMessageId);
    this.afterAppend(result);
    return { message: toCustomerMessageDto(result.message), duplicate: result.duplicate };
  }

  async markReadByCustomer(user: AccessTokenPayload, id: bigint, upToMessageId: bigint): Promise<SupportReadResult> {
    const conversation = await this.findOwnedOr404(user, id);
    const updated = await this.moveReadPointer(conversation, 'customer', upToMessageId, BigInt(user.sub));
    const totalUnread = await this.customerUnreadTotal(user);
    this.events.customerUnread(user.sub, totalUnread);
    return { unreadCount: updated.customerUnreadCount, totalUnread };
  }

  async customerUnreadTotal(user: Pick<AccessTokenPayload, 'sub'>): Promise<number> {
    const sum = await this.prisma.supportConversation.aggregate({ where: { customerId: BigInt(user.sub) }, _sum: { customerUnreadCount: true } });
    return sum._sum.customerUnreadCount ?? 0;
  }

  // ======================================================================================
  // Admin side
  // ======================================================================================

  async listForAdmin(query: SupportAdminListQueryDto): Promise<{ items: AdminSupportConversationSummaryDto[]; total: number }> {
    const where = this.adminWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supportConversation.findMany({
        where,
        include: SUPPORT_CONVERSATION_INCLUDE,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supportConversation.count({ where }),
    ]);
    return { items: rows.map(toAdminSummaryDto), total };
  }

  async getForAdmin(id: bigint): Promise<AdminSupportConversationDto> {
    const row = await this.findOr404(id);
    const [customerInfo, contextCard, statusChangedBy] = await Promise.all([
      this.customerInfo(row.customerId),
      this.contextCard(row),
      row.statusChangedByAdminId
        ? this.prisma.user.findUnique({ where: { id: row.statusChangedByAdminId }, select: { id: true, displayName: true, username: true } })
        : Promise.resolve(null),
    ]);
    return {
      ...toAdminSummaryDto(row),
      customerInfo,
      contextCard,
      customerLastReadMessageId: row.customerLastReadMessageId?.toString() ?? null,
      statusChangedAt: row.statusChangedAt?.toISOString() ?? null,
      statusChangedBy: statusChangedBy ? { id: statusChangedBy.id.toString(), displayName: displayNameOf(statusChangedBy) } : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listMessagesForAdmin(id: bigint, query: SupportMessagesQueryDto): Promise<MessagePage<AdminSupportMessageDto>> {
    await this.findOr404(id);
    const page = await this.pageMessages(id, query, true);
    return { items: page.items.map(toAdminMessageDto), hasMore: page.hasMore };
  }

  async sendAsAdmin(admin: AccessTokenPayload, id: bigint, dto: SendSupportMessageDto): Promise<{ message: AdminSupportMessageDto; duplicate: boolean }> {
    const adminId = BigInt(admin.sub);
    const conversation = await this.findOr404(id);
    const body = this.normalizeOrThrow(dto.body);
    await this.limiter.consume(`support:send:admin:${adminId}`, ADMIN_SEND_LIMIT.limit, ADMIN_SEND_LIMIT.windowSeconds);

    const result = await this.appendOrResolveConflict(conversation, 'admin', adminId, body, dto.clientMessageId);
    this.afterAppend(result);
    return { message: toAdminMessageDto(result.message), duplicate: result.duplicate };
  }

  async markReadByAdmin(admin: AccessTokenPayload, id: bigint, upToMessageId: bigint): Promise<AdminSupportReadResult> {
    const conversation = await this.findOr404(id);
    const updated = await this.moveReadPointer(conversation, 'admin', upToMessageId, BigInt(admin.sub));
    const totalUnreadConversations = await this.adminUnreadConversations();
    this.events.staffUnread(totalUnreadConversations);
    return { unreadCount: updated.adminUnreadCount, totalUnreadConversations };
  }

  async adminUnreadConversations(): Promise<number> {
    return this.prisma.supportConversation.count({ where: { adminUnreadCount: { gt: 0 } } });
  }

  // §16 — explicit Admin status change: writes an Admin-only system line and an audit-log row.
  async changeStatus(
    admin: AccessTokenPayload,
    id: bigint,
    status: SupportConversationStatus,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<AdminSupportConversationDto> {
    const adminId = BigInt(admin.sub);
    const current = await this.findOr404(id);
    if (current.status === status) return this.getForAdmin(id);

    let systemMessage: SupportMessageRow;
    let updated: SupportConversationRow;
    try {
      [updated, systemMessage] = await this.prisma.$transaction(async (tx) => {
        const conversation = await tx.supportConversation.update({
          where: { id },
          data: { status, statusChangedAt: new Date(), statusChangedByAdminId: adminId },
          include: SUPPORT_CONVERSATION_INCLUDE,
        });
        const message = await tx.supportMessage.create({
          data: { conversationId: id, senderType: 'system', senderUserId: adminId, body: `Status changed to ${STATUS_LABEL[status]}`, clientMessageId: randomUUID() },
          include: SUPPORT_MESSAGE_INCLUDE,
        });
        return [conversation, message] as const;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw await this.alreadyOpen(current);
      throw err;
    }

    await this.audit.record({
      adminUserId: adminId,
      actionType: 'SUPPORT_CONVERSATION_STATUS_CHANGED',
      resourceType: 'support_conversation',
      resourceId: id.toString(),
      changes: { from: current.status, to: status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    this.events.messageCreated(updated.customerId.toString(), null, toAdminMessageDto(systemMessage));
    this.events.conversationUpdated(updated.customerId.toString(), toCustomerSummaryDto(updated), toAdminSummaryDto(updated));
    return this.getForAdmin(id);
  }

  // ======================================================================================
  // Internals
  // ======================================================================================

  private async findOr404(id: bigint): Promise<SupportConversationRow> {
    const row = await this.prisma.supportConversation.findUnique({ where: { id }, include: SUPPORT_CONVERSATION_INCLUDE });
    if (!row) throw notFound();
    return row;
  }

  private normalizeOrThrow(raw: string): string {
    const result = normalizeSupportMessageBody(raw);
    if (result.ok) return result.body;
    const message = result.reason === 'empty' ? 'Message cannot be empty' : 'Message is too long (maximum 4000 characters)';
    throw new ApiException('VALIDATION_ERROR', 400, message, [{ field: 'body', message }]);
  }

  // §28.8 — a suspended customer can still read their history but cannot send.
  private async assertCustomerCanSend(customerId: bigint): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: customerId }, select: { status: true } });
    if (!user || user.status === 'suspended') {
      throw new ApiException('FORBIDDEN', 403, 'Your account cannot send support messages right now');
    }
  }

  // §19.1 — the context must exist AND belong to the caller, checked in one query; otherwise the
  // same 404 as a non-existent id.
  private async resolveOwnedContext(
    customerId: bigint,
    type: SupportContextType,
    contextId: string | undefined,
  ): Promise<{ field: (typeof CONTEXT_FK)[keyof typeof CONTEXT_FK]; id: bigint } | null> {
    if (type === 'general') {
      if (contextId !== undefined) throw new ApiException('VALIDATION_ERROR', 400, 'A general conversation has no context id', [{ field: 'contextId', message: 'must be empty for general' }]);
      return null;
    }
    if (!contextId) throw new ApiException('VALIDATION_ERROR', 400, 'contextId is required for this context type', [{ field: 'contextId', message: 'required' }]);
    const id = BigInt(contextId);
    const where = { id, customerId };
    const found =
      type === 'order'
        ? await this.prisma.order.findFirst({ where, select: { id: true } })
        : type === 'custom_request'
          ? await this.prisma.customRequest.findFirst({ where, select: { id: true } })
          : type === 'quote'
            ? await this.prisma.quote.findFirst({ where, select: { id: true } })
            : await this.prisma.fileFormatRequest.findFirst({ where, select: { id: true } });
    if (!found) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Not found');
    return { field: CONTEXT_FK[type], id };
  }

  private async findMessageByClientId(customerId: bigint, clientMessageId: string) {
    const message = await this.prisma.supportMessage.findFirst({
      where: { clientMessageId, senderType: 'customer', conversation: { customerId } },
      include: { ...SUPPORT_MESSAGE_INCLUDE, conversation: { include: SUPPORT_CONVERSATION_INCLUDE } },
    });
    return message ? { message, conversation: message.conversation } : null;
  }

  private startResult(conversation: SupportConversationRow, message: SupportMessageRow, created: boolean): StartSupportConversationResult {
    return { conversation: toCustomerConversationDto(conversation), message: toCustomerMessageDto(message), created };
  }

  // Append, translating a unique violation into either an idempotent replay (same clientMessageId)
  // or CONVERSATION_ALREADY_OPEN (reopening would create a 2nd active conversation, §16).
  private async appendOrResolveConflict(conversation: SupportConversationRow, side: Side, senderId: bigint, body: string, clientMessageId: string): Promise<AppendResult> {
    const replay = await this.findExistingInConversation(conversation.id, clientMessageId, side);
    if (replay) return replay;
    try {
      return await this.appendInTransaction(conversation.id, side, senderId, body, clientMessageId);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const raced = await this.findExistingInConversation(conversation.id, clientMessageId, side);
      if (raced) return raced;
      throw await this.alreadyOpen(conversation);
    }
  }

  private async findExistingInConversation(conversationId: bigint, clientMessageId: string, side: Side): Promise<AppendResult | null> {
    const message = await this.prisma.supportMessage.findUnique({
      where: { conversationId_clientMessageId: { conversationId, clientMessageId } },
      include: SUPPORT_MESSAGE_INCLUDE,
    });
    if (!message) return null;
    if (message.senderType !== side) {
      throw new ApiException('VALIDATION_ERROR', 400, 'clientMessageId already used', [{ field: 'clientMessageId', message: 'already used' }]);
    }
    const conversation = await this.findOr404(conversationId);
    return { conversation, message, duplicate: true };
  }

  private appendInTransaction(conversationId: bigint, side: Side, senderId: bigint, body: string, clientMessageId: string): Promise<AppendResult> {
    return this.prisma.$transaction((tx) => this.appendInTx(tx, conversationId, side, senderId, body, clientMessageId));
  }

  // The one place a customer/admin message is written: message row + denormalized last-message
  // fields + counters + the sender's own read pointer, in one transaction (§9.2, §15, §16).
  private async appendInTx(tx: Tx, conversationId: bigint, side: Side, senderId: bigint, body: string, clientMessageId: string): Promise<AppendResult> {
    const before = await tx.supportConversation.findUniqueOrThrow({ where: { id: conversationId }, select: { status: true } });
    const message = await tx.supportMessage.create({
      data: { conversationId, senderType: side, senderUserId: senderId, body, clientMessageId },
      include: SUPPORT_MESSAGE_INCLUDE,
    });

    const nextStatus: SupportConversationStatus =
      side === 'customer' ? 'open' : before.status === 'resolved' ? 'pending' : before.status;

    const common: Prisma.SupportConversationUpdateInput = {
      lastMessageAt: message.createdAt,
      lastMessagePreview: supportMessagePreview(body),
      lastMessageSenderType: side,
      status: nextStatus,
    };
    const sideData: Prisma.SupportConversationUpdateInput =
      side === 'customer'
        ? { customerLastReadMessageId: message.id, customerLastReadAt: message.createdAt, customerUnreadCount: 0, adminUnreadCount: { increment: 1 } }
        : { adminLastReadMessageId: message.id, adminLastReadAt: message.createdAt, adminUnreadCount: 0, customerUnreadCount: { increment: 1 } };

    const conversation = await tx.supportConversation.update({
      where: { id: conversationId },
      data: { ...common, ...sideData },
      include: SUPPORT_CONVERSATION_INCLUDE,
    });
    return { conversation, message, duplicate: false };
  }

  // Pushes + notifications after commit. Never awaited by the request path (§31).
  private afterAppend(result: AppendResult): void {
    if (result.duplicate) return;
    const { conversation, message } = result;
    const customerId = conversation.customerId.toString();
    const side = message.senderType as Side;

    this.events.messageCreated(customerId, toCustomerMessageDto(message), toAdminMessageDto(message));
    this.events.conversationUpdated(customerId, toCustomerSummaryDto(conversation), toAdminSummaryDto(conversation));
    // Sending implies having read the thread, so the sender's side is read up to this message.
    this.events.read(customerId, {
      conversationId: conversation.id.toString(),
      side: side === 'customer' ? 'customer' : 'support',
      lastReadMessageId: message.id.toString(),
      readAt: message.createdAt.toISOString(),
    });

    void (async () => {
      try {
        if (side === 'customer') {
          this.events.staffUnread(await this.adminUnreadConversations());
          this.events.customerUnread(customerId, await this.customerUnreadTotal({ sub: customerId }));
        } else {
          this.events.customerUnread(customerId, await this.customerUnreadTotal({ sub: customerId }));
          this.events.staffUnread(await this.adminUnreadConversations());
        }
      } catch (err) {
        this.logger.error(`Failed to push unread totals: ${(err as Error).message}`);
      }
    })();

    const ctx = {
      conversationId: conversation.id,
      customerId: conversation.customerId,
      customerName: displayNameOf(conversation.customer) ?? conversation.customer.email,
      contextLabel: contextLabelForNotification(conversation),
      preview: supportMessagePreview(message.body),
    };
    void (side === 'customer' ? this.notifier.customerWrote(ctx) : this.notifier.supportReplied(ctx));
  }

  // §15 — pointers only move forward and never past the newest message; counters are recomputed
  // from the pointer (self-heals any drift). Also marks this conversation's matching unread in-app
  // notifications read, so the bell and the chat badge never disagree.
  private async moveReadPointer(conversation: SupportConversationRow, side: Side, upToMessageId: bigint, readerId: bigint): Promise<SupportConversationRow> {
    const latest = await this.prisma.supportMessage.findFirst({
      where: { conversationId: conversation.id, id: { lte: upToMessageId }, senderType: { not: 'system' } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const currentPointer = side === 'customer' ? conversation.customerLastReadMessageId : conversation.adminLastReadMessageId;
    const target = latest?.id;
    const counterpart: SupportSenderType = side === 'customer' ? 'admin' : 'customer';

    let updated = conversation;
    let moved = false;
    if (target !== undefined && (currentPointer === null || target > currentPointer)) {
      const now = new Date();
      const unread = await this.prisma.supportMessage.count({ where: { conversationId: conversation.id, senderType: counterpart, id: { gt: target } } });
      updated = await this.prisma.supportConversation.update({
        where: { id: conversation.id },
        data:
          side === 'customer'
            ? { customerLastReadMessageId: target, customerLastReadAt: now, customerUnreadCount: unread }
            : { adminLastReadMessageId: target, adminLastReadAt: now, adminUnreadCount: unread },
        include: SUPPORT_CONVERSATION_INCLUDE,
      });
      moved = true;
      this.events.read(conversation.customerId.toString(), {
        conversationId: conversation.id.toString(),
        side: side === 'customer' ? 'customer' : 'support',
        lastReadMessageId: target.toString(),
        readAt: now.toISOString(),
      });
      this.events.conversationUpdated(conversation.customerId.toString(), toCustomerSummaryDto(updated), toAdminSummaryDto(updated));
    }

    // Admin side is team-level (§15): any reader clears their OWN notification for this thread.
    const unreadCountNow = side === 'customer' ? updated.customerUnreadCount : updated.adminUnreadCount;
    if (moved || unreadCountNow === 0) {
      await this.prisma.notification.updateMany({
        where: {
          recipientUserId: readerId,
          relatedSupportConversationId: conversation.id,
          notificationType: side === 'customer' ? 'support_reply' : 'support_message',
          isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
      });
    }
    return updated;
  }

  private async pageMessages(conversationId: bigint, query: SupportMessagesQueryDto, includeSystem: boolean): Promise<MessagePage<SupportMessageRow>> {
    if (query.before && query.after) {
      throw new ApiException('VALIDATION_ERROR', 400, 'Use either before or after, not both', [{ field: 'before', message: 'cannot be combined with after' }]);
    }
    const base: Prisma.SupportMessageWhereInput = { conversationId, ...(includeSystem ? {} : { senderType: { not: 'system' } }) };
    const take = query.limit + 1;

    if (query.after) {
      const rows = await this.prisma.supportMessage.findMany({
        where: { ...base, id: { gt: BigInt(query.after) } },
        include: SUPPORT_MESSAGE_INCLUDE,
        orderBy: { id: 'asc' },
        take,
      });
      return { items: rows.slice(0, query.limit), hasMore: rows.length > query.limit };
    }

    const rows = await this.prisma.supportMessage.findMany({
      where: { ...base, ...(query.before ? { id: { lt: BigInt(query.before) } } : {}) },
      include: SUPPORT_MESSAGE_INCLUDE,
      orderBy: { id: 'desc' },
      take,
    });
    return { items: rows.slice(0, query.limit).reverse(), hasMore: rows.length > query.limit };
  }

  // §22 — search/filter. All values go through Prisma's parameterized queries.
  private adminWhere(query: SupportAdminListQueryDto): Prisma.SupportConversationWhereInput {
    const and: Prisma.SupportConversationWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.unread) and.push({ adminUnreadCount: { gt: 0 } });
    if (query.contextType) and.push({ contextType: query.contextType });

    const q = query.q?.trim();
    if (q) {
      const text = { contains: q, mode: 'insensitive' as const };
      const or: Prisma.SupportConversationWhereInput[] = [
        { customer: { email: text } },
        { customer: { displayName: text } },
        { customer: { username: text } },
        { order: { bankTransferReference: { equals: q, mode: 'insensitive' } } },
        { customRequest: { requestNumber: { equals: q, mode: 'insensitive' } } },
      ];
      const numeric = /^#?(\d{1,18})$/.exec(q);
      if (numeric) {
        const n = BigInt(numeric[1]);
        or.push({ id: n }, { orderId: n }, { customRequestId: n }, { quoteId: n }, { fileFormatRequestId: n });
      }
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }

  private async customerInfo(customerId: bigint): Promise<SupportCustomerInfoDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        phone: true,
        preferredLocale: true,
        createdAt: true,
        status: true,
        _count: { select: { orders: true, customRequests: true, quotes: true } },
      },
    });
    const openConversations = await this.prisma.supportConversation.count({ where: { customerId, status: { not: 'resolved' } } });
    return {
      id: user.id.toString(),
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      preferredLocale: user.preferredLocale,
      memberSince: user.createdAt.toISOString(),
      accountStatus: user.status,
      counts: { orders: user._count.orders, customRequests: user._count.customRequests, quotes: user._count.quotes, openConversations },
      adminProfileHref: `/customers/${user.id}`,
    };
  }

  // §19.2 — minimal context card; the deep link's own page enforces its own permission.
  private async contextCard(row: SupportConversationRow): Promise<SupportContextCardDto | null> {
    const ref = toContextRef(row);
    switch (row.contextType) {
      case 'general':
        return null;
      case 'order': {
        const order = row.orderId
          ? await this.prisma.order.findUnique({
              where: { id: row.orderId },
              select: { id: true, status: true, paymentStatus: true, totalPkr: true, bankTransferReference: true, createdAt: true },
            })
          : null;
        if (!order) return unavailableCard('order', ref.label);
        return {
          type: 'order',
          id: order.id.toString(),
          label: order.id.toString(),
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalPkr: order.totalPkr.toString(),
          reference: order.bankTransferReference,
          createdAt: order.createdAt.toISOString(),
          adminHref: `/orders/${order.id}`,
          available: true,
        };
      }
      case 'custom_request': {
        const request = row.customRequestId
          ? await this.prisma.customRequest.findUnique({
              where: { id: row.customRequestId },
              select: { id: true, requestNumber: true, status: true, paymentStatus: true, createdAt: true },
            })
          : null;
        if (!request) return unavailableCard('custom_request', ref.label);
        return {
          type: 'custom_request',
          id: request.id.toString(),
          label: request.requestNumber,
          status: request.status,
          paymentStatus: request.paymentStatus,
          createdAt: request.createdAt.toISOString(),
          adminHref: '/custom-requests',
          available: true,
        };
      }
      case 'quote': {
        const quote = row.quoteId ? await this.prisma.quote.findUnique({ where: { id: row.quoteId }, select: { id: true, status: true, createdAt: true } }) : null;
        if (!quote) return unavailableCard('quote', ref.label);
        return { type: 'quote', id: quote.id.toString(), label: quote.id.toString(), status: quote.status, createdAt: quote.createdAt.toISOString(), adminHref: '/quotes', available: true };
      }
      case 'file_format_request': {
        const request = row.fileFormatRequestId
          ? await this.prisma.fileFormatRequest.findUnique({ where: { id: row.fileFormatRequestId }, select: { id: true, status: true, requestedFormat: true, createdAt: true } })
          : null;
        if (!request) return unavailableCard('file_format_request', ref.label);
        return {
          type: 'file_format_request',
          id: request.id.toString(),
          label: request.id.toString(),
          status: request.status,
          reference: request.requestedFormat,
          createdAt: request.createdAt.toISOString(),
          adminHref: '/file-format-requests',
          available: true,
        };
      }
    }
  }

  private async alreadyOpen(conversation: SupportConversationRow): Promise<ApiException> {
    const active = await this.prisma.supportConversation.findFirst({
      where: {
        customerId: conversation.customerId,
        contextType: conversation.contextType,
        orderId: conversation.orderId,
        customRequestId: conversation.customRequestId,
        quoteId: conversation.quoteId,
        fileFormatRequestId: conversation.fileFormatRequestId,
        status: { not: 'resolved' },
        id: { not: conversation.id },
      },
      select: { id: true },
    });
    const existingId = active?.id.toString() ?? '';
    return new ApiException('CONVERSATION_ALREADY_OPEN', 409, 'Another conversation about this is already open', [{ field: 'conversationId', message: existingId }]);
  }
}

function notFound(): ApiException {
  return new ApiException('RESOURCE_NOT_FOUND', 404, 'Conversation not found');
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function unavailableCard(type: SupportContextCardDto['type'], label: string | null): SupportContextCardDto {
  return { type, id: null, label, status: null, createdAt: null, adminHref: null, available: false };
}

function contextLabelForNotification(row: SupportConversationRow): string | null {
  const ref = toContextRef(row);
  if (ref.type === 'general' || !ref.label) return null;
  const noun = { order: 'Order', custom_request: 'Custom request', quote: 'Quote', file_format_request: 'Format request' }[ref.type];
  return `${noun} #${ref.label}`;
}
