import type { TaeboMessageDto, TaeboWaitingQuestionDto } from '@czd/shared-types';
import type { TaeboMessage, TaeboWaitingQuestion } from '../../generated/prisma';

export function toTaeboMessageDto(row: TaeboMessage): TaeboMessageDto {
  return {
    id: row.id.toString(),
    sender: row.sender,
    message: row.message,
    matchedFaqId: row.matchedFaqId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toTaeboWaitingQuestionDto(row: TaeboWaitingQuestion): TaeboWaitingQuestionDto {
  return {
    id: row.id.toString(),
    conversationId: row.conversationId.toString(),
    questionText: row.questionText,
    status: row.status,
    adminAnswer: row.adminAnswer,
    answeredByAdminId: row.answeredByAdminId?.toString() ?? null,
    savedAsFaqId: row.savedAsFaqId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
  };
}
