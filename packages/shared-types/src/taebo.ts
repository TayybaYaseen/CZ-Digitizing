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

// AC-2/AC-3/AC-4 — answer/matchedFaqId are present only when a genuine FAQ match was found;
// escalated=true means Taebo did not guess (no-match or a restricted topic).
export interface TaeboReplyDto {
  matchedFaqId?: string;
  answer?: string;
  escalated: boolean;
  conversationId: string;
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
