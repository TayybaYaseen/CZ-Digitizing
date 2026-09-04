import { CreditsService } from './credits.service';

interface FakeBalance {
  customerId: bigint;
  totalCredits: number;
  availableCredits: number;
  usedCredits: number;
}

function createFakePrisma() {
  const balances = new Map<string, FakeBalance>();
  const transactions: { id: bigint; customerId: bigint; type: string; amount: number; relatedOrderId?: bigint; giftCounterpartyId?: bigint }[] = [];
  const users = new Map<string, { id: bigint; email: string }>();
  let nextId = 1n;

  function applyDelta(customerId: bigint, delta: { totalDelta?: number; availableDelta?: number; usedDelta?: number }) {
    const existing = balances.get(customerId.toString()) ?? { customerId, totalCredits: 0, availableCredits: 0, usedCredits: 0 };
    existing.totalCredits += delta.totalDelta ?? 0;
    existing.availableCredits += delta.availableDelta ?? 0;
    existing.usedCredits += delta.usedDelta ?? 0;
    balances.set(customerId.toString(), existing);
    return existing;
  }

  const client: Record<string, unknown> & {
    _users: typeof users;
    _balances: typeof balances;
    _transactions: typeof transactions;
    _nextId: () => bigint;
  } = {
    customerCredits: {
      findUnique: jest.fn(async ({ where }: { where: { customerId: bigint } }) => balances.get(where.customerId.toString()) ?? null),
      upsert: jest.fn(async ({ where, create, update }: { where: { customerId: bigint }; create: FakeBalance; update: Record<string, { increment: number }> }) => {
        if (!balances.has(where.customerId.toString())) {
          balances.set(where.customerId.toString(), create);
          return create;
        }
        return applyDelta(where.customerId, {
          totalDelta: update.totalCredits?.increment,
          availableDelta: update.availableCredits?.increment,
          usedDelta: update.usedCredits?.increment,
        });
      }),
    },
    creditTransaction: {
      create: jest.fn(async ({ data }: { data: { customerId: bigint; type: string; amount: number; relatedOrderId?: bigint; giftCounterpartyId?: bigint } }) => {
        const row = { id: nextId++, ...data };
        transactions.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: { where: { relatedOrderId: bigint; type: string } }) =>
        transactions.find((t) => t.relatedOrderId === where.relatedOrderId && t.type === where.type) ?? null,
      ),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email: string } }) => users.get(where.email) ?? null),
    },
    creditPackage: {
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => ({ id: where.id })),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
    _users: users,
    _balances: balances,
    _transactions: transactions,
    _nextId: () => nextId++,
  };
  return client;
}

function fakeNotifications() {
  return { notify: jest.fn(async () => undefined) };
}

describe('CreditsService ledger arithmetic (AC-6/AC-7/AC-10, financial correctness)', () => {
  it('applyToOrder debits available and credits used, writing a usage row', async () => {
    const prisma = createFakePrisma();
    const service = new CreditsService(prisma as never, {} as never, {} as never, fakeNotifications() as never);
    const customerId = prisma._nextId();
    prisma._balances.set(customerId.toString(), { customerId, totalCredits: 500, availableCredits: 500, usedCredits: 0 });

    await service.applyToOrder(prisma as never, customerId, 999n, 200);

    const balance = await service.getBalance(customerId);
    expect(balance).toEqual({ available: 300, used: 200, total: 500 });
    expect(prisma._transactions).toContainEqual(expect.objectContaining({ customerId, type: 'usage', amount: -200, relatedOrderId: 999n }));
  });

  it('applyToOrder throws INSUFFICIENT_CREDITS rather than letting the balance go negative', async () => {
    const prisma = createFakePrisma();
    const service = new CreditsService(prisma as never, {} as never, {} as never, fakeNotifications() as never);
    const customerId = prisma._nextId();
    prisma._balances.set(customerId.toString(), { customerId, totalCredits: 50, availableCredits: 50, usedCredits: 0 });

    await expect(service.applyToOrder(prisma as never, customerId, 1n, 100)).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect((await service.getBalance(customerId)).available).toBe(50); // untouched
  });

  it('reverseUsageOnOrder restores exactly what that order consumed', async () => {
    const prisma = createFakePrisma();
    const service = new CreditsService(prisma as never, {} as never, {} as never, fakeNotifications() as never);
    const customerId = prisma._nextId();
    prisma._balances.set(customerId.toString(), { customerId, totalCredits: 500, availableCredits: 500, usedCredits: 0 });
    await service.applyToOrder(prisma as never, customerId, 42n, 150);

    await service.reverseUsageOnOrder(42n, 150);

    expect(await service.getBalance(customerId)).toEqual({ available: 500, used: 0, total: 500 });
  });

  it('gift moves credits atomically: sender debited, recipient credited, one adjustment row each', async () => {
    const prisma = createFakePrisma();
    const service = new CreditsService(prisma as never, {} as never, {} as never, fakeNotifications() as never);
    const sender = prisma._nextId();
    const recipient = prisma._nextId();
    prisma._balances.set(sender.toString(), { customerId: sender, totalCredits: 300, availableCredits: 300, usedCredits: 0 });
    prisma._users.set('recipient@example.com', { id: recipient, email: 'recipient@example.com' });

    await service.gift(sender, { recipientEmail: 'recipient@example.com', amount: 100 });

    expect(await service.getBalance(sender)).toEqual({ available: 200, used: 100, total: 300 });
    expect(await service.getBalance(recipient)).toEqual({ available: 100, used: 0, total: 100 });
    expect(prisma._transactions.filter((t) => t.type === 'adjustment')).toHaveLength(2);
  });

  it('gift rejects a gift larger than the sender\'s available balance', async () => {
    const prisma = createFakePrisma();
    const service = new CreditsService(prisma as never, {} as never, {} as never, fakeNotifications() as never);
    const sender = prisma._nextId();
    prisma._balances.set(sender.toString(), { customerId: sender, totalCredits: 10, availableCredits: 10, usedCredits: 0 });
    prisma._users.set('recipient@example.com', { id: prisma._nextId(), email: 'recipient@example.com' });

    await expect(service.gift(sender, { recipientEmail: 'recipient@example.com', amount: 50 })).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
  });

  it('deletePackage removes the package by id (always safe — nothing references a package by FK)', async () => {
    const prisma = createFakePrisma();
    const service = new CreditsService(prisma as never, {} as never, {} as never, fakeNotifications() as never);

    await service.deletePackage('7');

    expect((prisma.creditPackage as { delete: jest.Mock }).delete).toHaveBeenCalledWith({ where: { id: 7n } });
  });

  it('grant increases both total and available (a subscription\'s monthly credit allotment)', async () => {
    const prisma = createFakePrisma();
    const service = new CreditsService(prisma as never, {} as never, {} as never, fakeNotifications() as never);
    const customerId = prisma._nextId();

    await service.grant(prisma as never, customerId, 250, 'Monthly grant');

    expect(await service.getBalance(customerId)).toEqual({ available: 250, used: 0, total: 250 });
  });
});
