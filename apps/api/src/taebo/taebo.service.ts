import { Injectable } from '@nestjs/common';
import type { TaeboReplyDto, TaeboSuggestionDto } from '@czd/shared-types';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { FaqService } from '../faq/faq.service';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TaeboAnswerDto, TaeboChatDto } from './dto/taebo-chat.dto';
import { toTaeboWaitingQuestionDto } from './dto/taebo.mapper';
import type { TaeboWaitingQueryDto } from './dto/taebo-waiting-query.dto';
import { TaeboMatchingService } from './taebo-matching.service';
import { isRestrictedTopic } from './taebo-restricted-topics.util';

// docs/specs/2026-08-28-15-taebo-chatbot.md §3/§4 (aspect A-020). The anti-fabrication contract
// (AC-3/AC-4/AC-7) lives entirely in chat() below: restricted-topic check first, then match,
// escalate on either a restricted topic or no match — there is no other path that can produce an
// `answer`.
@Injectable()
export class TaeboService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faqs: FaqService,
    private readonly matching: TaeboMatchingService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogService,
  ) {}

  async chat(dto: TaeboChatDto, customerId?: string): Promise<TaeboReplyDto> {
    const conversation = await this.resolveConversation(dto.conversationId, dto.sessionId, customerId);

    await this.prisma.taeboMessage.create({
      data: { conversationId: conversation.id, sender: 'customer', message: dto.message },
    });

    // AC-4 — a restricted topic (payment/price/order-status/file-availability) always escalates,
    // even if a loosely-matching FAQ exists. Checked before matching, not after, so a match can
    // never override this.
    const restricted = isRestrictedTopic(dto.message);
    const match = restricted ? null : await this.matching.findBestMatch(dto.message, dto.languageCode);

    if (match) {
      await this.prisma.taeboMessage.create({
        data: { conversationId: conversation.id, sender: 'taebo', message: match.faq.answer, matchedFaqId: BigInt(match.faq.id) },
      });
      await this.touchConversation(conversation.id);
      return { matchedFaqId: match.faq.id, answer: match.faq.answer, escalated: false, conversationId: conversation.id.toString() };
    }

    // AC-3/AC-4 — no verifiable answer: never guess. Record as waiting and notify Admin.
    await this.prisma.taeboWaitingQuestion.create({
      data: { conversationId: conversation.id, questionText: dto.message },
    });
    const escalationMessage = "I've passed this to our team — you'll hear back soon.";
    await this.prisma.taeboMessage.create({
      data: { conversationId: conversation.id, sender: 'taebo', message: escalationMessage },
    });
    await this.touchConversation(conversation.id);
    await this.notifyAdminsWaiting(dto.message);

    return { escalated: true, conversationId: conversation.id.toString() };
  }

  // AC-2 — page-aware suggested questions (e.g. catalog FAQs on a design page).
  async suggestions(page?: string, languageCode?: string): Promise<TaeboSuggestionDto[]> {
    const faqs = await this.faqs.listTaeboVisible(languageCode);
    const scoped = page ? faqs.filter((f) => f.relatedPage === page) : [];
    const pool = scoped.length > 0 ? scoped : faqs;
    return pool.slice(0, 6).map((f) => ({ faqId: f.id, question: f.question, topic: f.topic }));
  }

  async listWaiting(query: TaeboWaitingQueryDto) {
    const where = query.status ? { status: query.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.taeboWaitingQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.taeboWaitingQuestion.count({ where }),
    ]);
    return { items: rows.map(toTaeboWaitingQuestionDto), total };
  }

  // AC-5 — Admin answers a waiting question; the customer who asked is notified.
  async answer(id: string, dto: TaeboAnswerDto, admin: AccessTokenPayload) {
    const waiting = await this.findWaitingOrThrow(id);
    const conversation = await this.prisma.taeboConversation.findUniqueOrThrow({ where: { id: waiting.conversationId } });

    const updated = await this.prisma.taeboWaitingQuestion.update({
      where: { id: waiting.id },
      data: { status: 'answered', adminAnswer: dto.answer, answeredByAdminId: BigInt(admin.sub), answeredAt: new Date() },
    });
    await this.prisma.taeboMessage.create({
      data: { conversationId: waiting.conversationId, sender: 'admin', message: dto.answer },
    });

    if (conversation.customerId) {
      await this.notifications.notify({
        recipientUserId: conversation.customerId.toString(),
        type: 'taebo_answered',
        title: 'Taebo has an answer for you',
        message: dto.answer,
        channels: ['email', 'in_app'],
      });
    }

    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'TAEBO_QUESTION_ANSWERED', resourceType: 'taebo_waiting_question', resourceId: id });
    return toTaeboWaitingQuestionDto(updated);
  }

  // AC-5 — "Save as FAQ" creates a new published faqs row pre-filled from the Q&A.
  async saveAsFaq(id: string, admin: AccessTokenPayload) {
    const waiting = await this.findWaitingOrThrow(id);
    if (!waiting.adminAnswer) throw new ApiException('VALIDATION_ERROR', 400, 'Question has not been answered yet');

    const faq = await this.faqs.create(
      {
        question: waiting.questionText,
        answer: waiting.adminAnswer,
        topic: 'General',
        taeboVisible: true,
        isPublished: true,
      },
      admin,
    );

    await this.prisma.taeboWaitingQuestion.update({ where: { id: waiting.id }, data: { savedAsFaqId: BigInt(faq.id) } });
    return faq;
  }

  private async resolveConversation(conversationId: string | undefined | null, sessionId: string, customerId?: string) {
    if (conversationId) {
      const existing = await this.prisma.taeboConversation.findUnique({ where: { id: BigInt(conversationId) } });
      if (existing) return existing;
    }
    return this.prisma.taeboConversation.create({
      data: { sessionId, customerId: customerId ? BigInt(customerId) : undefined },
    });
  }

  private async touchConversation(id: bigint) {
    await this.prisma.taeboConversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
  }

  private async notifyAdminsWaiting(questionText: string) {
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    for (const admin of admins) {
      await this.notifications.notify({
        recipientUserId: admin.id.toString(),
        type: 'taebo_waiting',
        title: 'Taebo needs help answering a question',
        message: questionText,
        channels: ['email', 'in_app'],
      });
    }
  }

  private async findWaitingOrThrow(id: string) {
    const row = await this.prisma.taeboWaitingQuestion.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Waiting question not found');
    return row;
  }
}
