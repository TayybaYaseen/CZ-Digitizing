import type { QuoteDto, QuoteMessageDto } from '@czd/shared-types';
import type { Quote, QuoteMessage } from '../../generated/prisma';

// includeAccessToken — only ever true on the response to the request that just created/owns this
// draft (createDraft, updateDraft, submit, and getById when called with a matching accessToken).
// Never included on admin reads or authenticated-history reads.
export function toQuoteDto(row: Quote, includeAccessToken = false): QuoteDto {
  return {
    id: row.id.toString(),
    customerId: row.customerId ? row.customerId.toString() : null,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    country: row.country,
    serviceId: row.serviceId.toString(),
    designUploadPath: row.designUploadPath,
    size: row.size,
    quantity: row.quantity,
    fabric: row.fabric,
    threadColors: row.threadColors,
    formatPreference: row.formatPreference,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    instructions: row.instructions,
    status: row.status,
    ...(includeAccessToken ? { accessToken: row.accessToken } : {}),
    suggestedPricePkr: row.suggestedPricePkr ? row.suggestedPricePkr.toString() : null,
    quotedPricePkr: row.quotedPricePkr ? row.quotedPricePkr.toString() : null,
    adminNotes: row.adminNotes,
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
    orderId: row.orderId ? row.orderId.toString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toQuoteMessageDto(row: QuoteMessage): QuoteMessageDto {
  return {
    id: row.id.toString(),
    quoteId: row.quoteId.toString(),
    senderRole: row.senderRole,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
