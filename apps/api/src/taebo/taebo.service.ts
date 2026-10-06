import { Injectable, Logger } from '@nestjs/common';
import type { TaeboNoticeKey, TaeboReplyDto, TaeboSuggestionDto } from '@czd/shared-types';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { FaqService } from '../faq/faq.service';
import { DEFAULT_CHANNELS } from '../notifications/notifications.constants';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TaeboAnswerDto, TaeboChatDto } from './dto/taebo-chat.dto';
import { toTaeboWaitingQuestionDto } from './dto/taebo.mapper';
import type { TaeboWaitingQueryDto } from './dto/taebo-waiting-query.dto';
import { detectSmallTalk } from './taebo-intent.util';
import type { TaeboHistoryEntry } from './taebo-llm-matching.service';
import { TaeboMatchingService } from './taebo-matching.service';
import { isInternalInfoRequest, isRestrictedTopic } from './taebo-restricted-topics.util';

// Enough for a follow-up to resolve "it"/"that" against the last couple of exchanges.
const HISTORY_MESSAGES = 6;

// Stored in the transcript and sent as `answer` for clients that don't render `noticeKey` — the web
// widget shows its own translated `taebo.notice.*` / `taebo.escalated*` text instead.
const NOTICE_FALLBACK_TEXT: Record<TaeboNoticeKey, string> = {
  hello: 'Hi there! How can I help you today?',
  thanks: "You're welcome! Is there anything else I can help you with?",
  ack: 'Got it! Is there anything else I can help you with?',
  help: "I'd be glad to help! Ask me about our designs, embroidery digitizing, vector art, pricing, file formats, orders or custom requests.",
  internal: "Sorry, I can't share internal or private information. I'm happy to help with CZ Digitizing's designs, services, orders and pricing.",
  account: "I can't see account details such as payments or order status here, so I've sent your question to our team. You can also check Your Orders.",
};
const ESCALATION_MESSAGE =
  "I'm not completely sure about that yet, so I've sent your question to our team — they'll follow up with you. I can help with CZ Digitizing's services, designs, orders, file formats, pricing and custom requests.";

// docs/specs/2026-08-28-15-taebo-chatbot.md §3/§4 (aspect A-020). The anti-fabrication contract
// (AC-3/AC-4/AC-7) lives entirely in chat() below: internal-info and account-specific checks first,
// then a grounded answer from approved content (TaeboMatchingService.resolve, whose LLM output is
// verified against its cited sources), and escalation whenever there is none — no other path can
// produce a factual `answer`.
@Injectable()
export class TaeboService {
  private readonly logger = new Logger(TaeboService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqs: FaqService,
    private readonly matching: TaeboMatchingService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogService,
  ) {}

  async chat(dto: TaeboChatDto, customerId?: string): Promise<TaeboReplyDto> {
    const message = dto.message.trim();
    const conversation = await this.resolveConversation(dto.conversationId, dto.sessionId, customerId);
    const conversationId = conversation.id.toString();
    // Read before saving the new message, so history is "what came before this question" — this
    // is what lets follow-ups ("what about DST?") be understood without repeating context.
    const history = await this.recentHistory(conversation.id);

    await this.prisma.taeboMessage.create({
      data: { conversationId: conversation.id, sender: 'customer', message },
    });

    // Requests for internal/system information are declined outright — never sent to the matcher,
    // the LLM or Admin's queue.
    if (isInternalInfoRequest(message)) return this.notice(conversation.id, 'internal');

    // AC-4 — account-specific questions (this customer's payment/order/refund/file status) always
    // escalate, even if a loosely-matching FAQ exists. Checked before matching, not after, so a
    // match can never override this.
    if (isRestrictedTopic(message)) return this.escalate(conversation.id, message, 'account');

    const smallTalk = detectSmallTalk(message);
    if (smallTalk) return this.notice(conversation.id, smallTalk);

    const resolution = await this.matching.resolve({ message, history, languageCode: dto.languageCode });

    if (resolution?.type === 'answer') {
      await this.saveTaeboMessage(conversation.id, resolution.answer, resolution.faqId);
      return { matchedFaqId: resolution.faqId, answer: resolution.answer, escalated: false, conversationId };
    }
    if (resolution?.type === 'reply') {
      await this.saveTaeboMessage(conversation.id, resolution.answer);
      return { answer: resolution.answer, escalated: false, conversationId };
    }
    if (resolution?.type === 'clarify') {
      const options = resolution.options.map((f) => ({ faqId: f.id, question: f.question, topic: f.topic }));
      const text = `Could you tell me a little more? Did you mean: ${options.map((o) => o.question).join(' / ')}`;
      await this.saveTaeboMessage(conversation.id, text);
      return { answer: text, escalated: false, conversationId, options };
    }

    // AC-4 — the LLM recognised an account-specific question the English-only gate above missed.
    if (resolution?.type === 'account') return this.escalate(conversation.id, message, 'account');

    // AC-3 — no verifiable answer: never guess. Record as waiting and notify Admin.
    return this.escalate(conversation.id, message);
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
        channels: DEFAULT_CHANNELS.taebo_answered,
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

  private async recentHistory(conversationId: bigint): Promise<TaeboHistoryEntry[]> {
    const rows = await this.prisma.taeboMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_MESSAGES,
    });
    return rows.reverse().map((r) => ({ sender: r.sender, message: r.message }));
  }

  private async saveTaeboMessage(conversationId: bigint, message: string, matchedFaqId?: string) {
    await this.prisma.taeboMessage.create({
      data: { conversationId, sender: 'taebo', message, matchedFaqId: matchedFaqId ? BigInt(matchedFaqId) : undefined },
    });
    await this.touchConversation(conversationId);
  }

  private async notice(conversationId: bigint, noticeKey: TaeboNoticeKey): Promise<TaeboReplyDto> {
    const answer = NOTICE_FALLBACK_TEXT[noticeKey];
    await this.saveTaeboMessage(conversationId, answer);
    return { answer, noticeKey, escalated: false, conversationId: conversationId.toString() };
  }

  private async escalate(conversationId: bigint, questionText: string, noticeKey?: TaeboNoticeKey): Promise<TaeboReplyDto> {
    // The same question asked again in the same conversation (e.g. a retry) is already in Admin's
    // queue — don't create a duplicate row or a second notification for it.
    const duplicate = await this.prisma.taeboWaitingQuestion.findFirst({
      where: { conversationId, status: 'waiting', questionText: { equals: questionText, mode: 'insensitive' } },
    });
    if (!duplicate) {
      await this.prisma.taeboWaitingQuestion.create({ data: { conversationId, questionText } });
      // Not awaited: delivery (email etc.) took ~20s and the customer was left watching the typing
      // indicator. The waiting row just created is the durable record Admin's queue reads.
      void this.notifyAdminsWaiting(questionText);
    }
    await this.saveTaeboMessage(conversationId, ESCALATION_MESSAGE);
    return { escalated: true, noticeKey, conversationId: conversationId.toString() };
  }

  // The waiting row above is the durable record (Admin's /taebo/unanswered list reads it), so a
  // notification-delivery failure is logged, not thrown — previously it turned into a 500 for the
  // customer after the question had already been saved, and their retry created a duplicate.
  private async notifyAdminsWaiting(questionText: string) {
    let admins: { id: bigint }[];
    try {
      admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    } catch (err) {
      this.logger.error(`Failed to load admins to notify about a waiting Taebo question: ${(err as Error).message}`);
      return;
    }
    for (const admin of admins) {
      try {
        await this.notifications.notify({
          recipientUserId: admin.id.toString(),
          type: 'taebo_waiting',
          title: 'Taebo needs help answering a question',
          message: questionText,
          channels: DEFAULT_CHANNELS.taebo_waiting,
        });
      } catch (err) {
        this.logger.error(`Failed to notify admin ${admin.id} about a waiting Taebo question: ${(err as Error).message}`);
      }
    }
  }

  private async findWaitingOrThrow(id: string) {
    const row = await this.prisma.taeboWaitingQuestion.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Waiting question not found');
    return row;
  }
}
