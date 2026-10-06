// Mirrors docs/specs/2026-08-28-15-taebo-chatbot.md §3-4 (aspect A-020).

export type TaeboSender = 'customer' | 'taebo' | 'admin';

export type TaeboWaitingStatus = 'waiting' | 'answered';

export interface TaeboMessageDto {
  id: string;
  sender: TaeboSender;
  message: string;
  matchedFaqId: string | null;
  createdAt: string;
}

export interface TaeboChatRequestDto {
  message: string;
  conversationId: string | null;
  sessionId: string;
  page: string | null;
}

// Taebo's own fixed UI replies — clients render these from their i18n bundle (`taebo.notice.*`)
// so they follow the visitor's language; `answer` carries an English fallback for older clients.
//   hello/thanks/ack/help — conversational messages that aren't questions
//   internal             — a request for internal/system information, politely declined
//   account              — (escalated) needs live account data Taebo can't see (AC-4)
export type TaeboNoticeKey = 'hello' | 'thanks' | 'ack' | 'help' | 'internal' | 'account';

// AC-2/AC-3/AC-4 — `answer` is either grounded in approved content (matchedFaqId set when the main
// source was an FAQ entry), a conversational/clarifying reply that states no facts, or absent.
// escalated=true means Taebo did not guess (no grounded answer, or a restricted topic) and the
// question was sent to Admin.
export interface TaeboReplyDto {
  matchedFaqId?: string;
  answer?: string;
  escalated: boolean;
  conversationId: string;
  noticeKey?: TaeboNoticeKey;
  // A very short, ambiguous question ("order?") matching several FAQs — offered as "did you mean".
  options?: TaeboSuggestionDto[];
}

export interface TaeboSuggestionDto {
  faqId: string;
  question: string;
  topic: string;
}

export interface TaeboWaitingQuestionDto {
  id: string;
  conversationId: string;
  questionText: string;
  status: TaeboWaitingStatus;
  adminAnswer: string | null;
  answeredByAdminId: string | null;
  savedAsFaqId: string | null;
  createdAt: string;
  answeredAt: string | null;
}

export interface TaeboAnswerWaitingQuestionDto {
  answer: string;
}
