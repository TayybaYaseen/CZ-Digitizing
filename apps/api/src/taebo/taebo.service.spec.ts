import { TaeboService } from './taebo.service';

function createFakePrisma() {
  const conversations = new Map<bigint, { id: bigint; sessionId: string; customerId: bigint | null }>();
  const messages: Record<string, unknown>[] = [];
  const waitingQuestions: { id: bigint; conversationId: bigint; status: string }[] = [];
  let nextId = 1n;

  return {
    _messages: messages,
    _waitingQuestions: waitingQuestions,
    taeboConversation: {
      findUnique: jest.fn(async ({ where }: { where: { id: bigint } }) => conversations.get(where.id) ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: bigint } }) => conversations.get(where.id)!),
      create: jest.fn(async ({ data }: { data: { sessionId: string; customerId?: bigint } }) => {
        const row = { id: nextId++, sessionId: data.sessionId, customerId: data.customerId ?? null };
        conversations.set(row.id, row);
        return row;
      }),
      update: jest.fn(async () => undefined),
    },
    taeboMessage: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        messages.push(data);
        return { id: nextId++, ...data };
      }),
    },
    taeboWaitingQuestion: {
      create: jest.fn(async ({ data }: { data: { conversationId: bigint } }) => {
        const row = { id: nextId++, conversationId: data.conversationId, status: 'waiting' };
        waitingQuestions.push(row);
        return row;
      }),
    },
    user: {
      findMany: jest.fn(async () => [{ id: 99n, role: 'admin' }]),
    },
  };
}

function createFakeFaqService() {
  return { create: jest.fn() };
}

function createFakeMatching(result: unknown) {
  return { findBestMatch: jest.fn(async () => result) };
}

function createFakeNotifications() {
  return { notify: jest.fn(async () => undefined) };
}

function createFakeAudit() {
  return { record: jest.fn(async () => undefined) };
}

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-2/AC-3/AC-4 — the anti-fabrication contract.
describe('TaeboService.chat', () => {
  it('returns a matched answer when a confident FAQ match exists (AC-2)', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching({ faq: { id: '5', answer: 'We support DST and PES.' }, score: 0.8 });
    const notifications = createFakeNotifications();
    const service = new TaeboService(prisma as never, createFakeFaqService() as never, matching as never, notifications as never, createFakeAudit() as never);

    const reply = await service.chat({ message: 'What formats do you support?', conversationId: undefined, sessionId: 's1', page: undefined } as never);

    expect(reply.escalated).toBe(false);
    expect(reply.matchedFaqId).toBe('5');
    expect(reply.answer).toBe('We support DST and PES.');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('escalates and never fabricates an answer when there is no match (AC-3)', async () => {
    const prisma = createFakePrisma();
    const matching = createFakeMatching(null);
    const notifications = createFakeNotifications();
    const service = new TaeboService(prisma as never, createFakeFaqService() as never, matching as never, notifications as never, createFakeAudit() as never);

    const reply = await service.chat({ message: 'Do you ship to Antarctica?', conversationId: undefined, sessionId: 's1', page: undefined } as never);

    expect(reply.escalated).toBe(true);
    expect(reply.answer).toBeUndefined();
    expect(prisma._waitingQuestions).toHaveLength(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'taebo_waiting', recipientUserId: '99' }));
  });

  it('AC-4: a restricted-topic question always escalates even if the matcher would have matched', async () => {
    const prisma = createFakePrisma();
    // Matching service would happily return a (wrong) match — chat() must never even call it.
    const matching = createFakeMatching({ faq: { id: '5', answer: 'Some loosely related FAQ answer.' }, score: 0.9 });
    const notifications = createFakeNotifications();
    const service = new TaeboService(prisma as never, createFakeFaqService() as never, matching as never, notifications as never, createFakeAudit() as never);

    const reply = await service.chat({ message: 'Has my payment gone through yet?', conversationId: undefined, sessionId: 's1', page: undefined } as never);

    expect(reply.escalated).toBe(true);
    expect(matching.findBestMatch).not.toHaveBeenCalled();
    expect(prisma._waitingQuestions).toHaveLength(1);
  });
});
