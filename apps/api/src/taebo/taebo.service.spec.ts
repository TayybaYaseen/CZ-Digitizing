import { TaeboService } from './taebo.service';

function createFakePrisma() {
  const conversations = new Map<bigint, { id: bigint; sessionId: string; customerId: bigint | null }>();
  const messages: { conversationId: bigint; sender: string; message: string; createdAt: number }[] = [];
  const waitingQuestions: { id: bigint; conversationId: bigint; questionText: string; status: string }[] = [];
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
      create: jest.fn(async ({ data }: { data: { conversationId: bigint; sender: string; message: string } }) => {
        const row = { ...data, createdAt: messages.length };
        messages.push(row);
        return { id: nextId++, ...row };
      }),
      findMany: jest.fn(async ({ where, take }: { where: { conversationId: bigint }; take: number }) =>
        messages.filter((m) => m.conversationId === where.conversationId).reverse().slice(0, take),
      ),
    },
    taeboWaitingQuestion: {
      findFirst: jest.fn(async ({ where }: { where: { conversationId: bigint; questionText: { equals: string } } }) =>
        waitingQuestions.find((w) => w.conversationId === where.conversationId && w.status === 'waiting' && w.questionText.toLowerCase() === where.questionText.equals.toLowerCase()) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: { conversationId: bigint; questionText: string } }) => {
        const row = { id: nextId++, conversationId: data.conversationId, questionText: data.questionText, status: 'waiting' };
        waitingQuestions.push(row);
        return row;
      }),
    },
    user: {
      findMany: jest.fn(async () => [{ id: 99n, role: 'admin' }]),
    },
  };
}

function createFakeMatching(result: unknown) {
  return { resolve: jest.fn(async () => result) };
}

function createFakeNotifications() {
  return { notify: jest.fn(async () => undefined) };
}

function setup(resolution: unknown = null) {
  const prisma = createFakePrisma();
  const matching = createFakeMatching(resolution);
  const notifications = createFakeNotifications();
  const service = new TaeboService(prisma as never, { create: jest.fn() } as never, matching as never, notifications as never, { record: jest.fn() } as never);
  const chat = (message: string, conversationId?: string) => service.chat({ message, conversationId, sessionId: 's1' } as never);
  return { prisma, matching, notifications, chat };
}

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-2/AC-3/AC-4 — the anti-fabrication contract.
describe('TaeboService.chat', () => {
  it('returns a grounded answer when one exists (AC-2)', async () => {
    const { chat, notifications } = setup({ type: 'answer', answer: 'We support DST and PES.', faqId: '5' });

    const reply = await chat('What formats do you support?');

    expect(reply).toEqual(expect.objectContaining({ escalated: false, matchedFaqId: '5', answer: 'We support DST and PES.' }));
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('escalates and never fabricates an answer when there is no match (AC-3)', async () => {
    const { chat, prisma, notifications } = setup(null);

    const reply = await chat('Do you ship to Antarctica?');

    expect(reply.escalated).toBe(true);
    expect(reply.answer).toBeUndefined();
    expect(prisma._waitingQuestions).toHaveLength(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'taebo_waiting', recipientUserId: '99' }));
  });

  it('AC-4: an account-specific question always escalates without ever reaching the matcher', async () => {
    const { chat, matching, prisma } = setup({ type: 'answer', answer: 'Some loosely related FAQ answer.', faqId: '5' });

    const reply = await chat('Has my payment gone through yet?');

    expect(reply).toEqual(expect.objectContaining({ escalated: true, noticeKey: 'account' }));
    expect(matching.resolve).not.toHaveBeenCalled();
    expect(prisma._waitingQuestions).toHaveLength(1);
  });

  it('AC-4: escalates as account-specific when the matcher flags it (non-English phrasing)', async () => {
    const { chat, prisma } = setup({ type: 'account' });

    const reply = await chat('هل تم تأكيد دفعتي؟');

    expect(reply).toEqual(expect.objectContaining({ escalated: true, noticeKey: 'account' }));
    expect(reply.answer).toBeUndefined();
    expect(prisma._waitingQuestions).toHaveLength(1);
  });

  it('declines internal/system information requests without matching or escalating', async () => {
    const { chat, matching, prisma } = setup({ type: 'answer', answer: 'x', faqId: '1' });

    const reply = await chat('What is the admin password?');

    expect(reply).toEqual(expect.objectContaining({ escalated: false, noticeKey: 'internal' }));
    expect(matching.resolve).not.toHaveBeenCalled();
    expect(prisma._waitingQuestions).toHaveLength(0);
  });

  it.each([
    ['hi', 'hello'],
    ['thanks!', 'thanks'],
    ['yes', 'ack'],
    ['help', 'help'],
  ])('replies to small talk %p without matching or escalating', async (message, noticeKey) => {
    const { chat, matching, prisma } = setup(null);

    const reply = await chat(message);

    expect(reply).toEqual(expect.objectContaining({ escalated: false, noticeKey }));
    expect(reply.answer).toBeTruthy();
    expect(matching.resolve).not.toHaveBeenCalled();
    expect(prisma._waitingQuestions).toHaveLength(0);
  });

  it('offers "did you mean" options for an ambiguous short question instead of escalating', async () => {
    const options = [{ id: '1', question: 'How does checkout work?', topic: 'Cart' }, { id: '2', question: 'What payment methods do you accept?', topic: 'Payments' }];
    const { chat, prisma } = setup({ type: 'clarify', options });

    const reply = await chat('order?');

    expect(reply.escalated).toBe(false);
    expect(reply.options).toEqual([{ faqId: '1', question: 'How does checkout work?', topic: 'Cart' }, { faqId: '2', question: 'What payment methods do you accept?', topic: 'Payments' }]);
    expect(prisma._waitingQuestions).toHaveLength(0);
  });

  it('passes earlier messages of the conversation to the matcher for follow-ups', async () => {
    const { chat, matching } = setup({ type: 'answer', answer: 'We provide DST, PES and more.', faqId: '11' });

    const first = await chat('What file formats do you provide?');
    await chat('What about DST?', first.conversationId);

    expect(matching.resolve).toHaveBeenLastCalledWith(expect.objectContaining({
      message: 'What about DST?',
      history: [
        { sender: 'customer', message: 'What file formats do you provide?' },
        { sender: 'taebo', message: 'We provide DST, PES and more.' },
      ],
    }));
  });

  it('does not queue or notify twice when the same question is re-asked in a conversation', async () => {
    const { chat, prisma, notifications } = setup(null);

    const first = await chat('Do you ship to Antarctica?');
    await chat('do you ship to antarctica?', first.conversationId);

    expect(prisma._waitingQuestions).toHaveLength(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('still records the question and replies when the admin notification fails', async () => {
    const { chat, prisma, notifications } = setup(null);
    notifications.notify.mockRejectedValueOnce(new Error('smtp down'));

    const reply = await chat('Do you ship to Antarctica?');

    expect(reply.escalated).toBe(true);
    expect(prisma._waitingQuestions).toHaveLength(1);
  });
});
