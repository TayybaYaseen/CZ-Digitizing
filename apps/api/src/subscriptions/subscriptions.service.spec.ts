import { SubscriptionsService, LOW_LOGO_LIMIT_THRESHOLD } from './subscriptions.service';

interface FakeSubscription {
  id: bigint;
  customerId: bigint;
  planId: bigint;
  status: 'active' | 'cancelled' | 'lapsed';
  logosUsed: number;
  logoLimitWarnedAt: Date | null;
}

interface FakePlan {
  id: bigint;
  name: string;
  logoLimit: number | null;
}

function createFakePrisma() {
  const subscriptions = new Map<string, FakeSubscription>();
  const plans = new Map<string, FakePlan>();
  const emails = new Map<string, string>();

  function withPlan(sub: FakeSubscription) {
    return { ...sub, plan: plans.get(sub.planId.toString())! };
  }

  const client = {
    customerSubscription: {
      findUnique: jest.fn(async ({ where }: { where: { customerId: bigint } }) => {
        const sub = subscriptions.get(where.customerId.toString());
        return sub ? withPlan(sub) : null;
      }),
      findMany: jest.fn(async () => Array.from(subscriptions.values()).map((sub) => ({ ...withPlan(sub), customer: { email: emails.get(sub.customerId.toString()) } }))),
      update: jest.fn(async ({ where, data }: { where: { customerId: bigint }; data: Partial<FakeSubscription> }) => {
        const existing = subscriptions.get(where.customerId.toString())!;
        const updated = { ...existing, ...data };
        subscriptions.set(where.customerId.toString(), updated);
        return withPlan(updated);
      }),
      count: jest.fn(async ({ where }: { where: { planId: bigint } }) => Array.from(subscriptions.values()).filter((s) => s.planId === where.planId).length),
    },
    subscriptionPlan: {
      findUnique: jest.fn(async ({ where }: { where: { id: bigint } }) => plans.get(where.id.toString()) ?? null),
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        const plan = plans.get(where.id.toString());
        plans.delete(where.id.toString());
        return plan;
      }),
    },
    _subscriptions: subscriptions,
    _plans: plans,
    _emails: emails,
  };
  return client;
}

function fakeNotifications() {
  return { notify: jest.fn(async () => undefined) };
}

describe('SubscriptionsService logo download limits (admin-requested extension)', () => {
  function seed(prisma: ReturnType<typeof createFakePrisma>, opts: { logoLimit: number | null; logosUsed?: number; logoLimitWarnedAt?: Date | null }) {
    const customerId = 1n;
    const planId = 10n;
    prisma._plans.set(planId.toString(), { id: planId, name: 'Gold Plan', logoLimit: opts.logoLimit });
    prisma._subscriptions.set(customerId.toString(), {
      id: 100n,
      customerId,
      planId,
      status: 'active',
      logosUsed: opts.logosUsed ?? 0,
      logoLimitWarnedAt: opts.logoLimitWarnedAt ?? null,
    });
    prisma._emails.set(customerId.toString(), 'customer@example.com');
    return customerId;
  }

  it('decrements the allowance on every consume and never throws while under the limit', async () => {
    const prisma = createFakePrisma();
    const notifications = fakeNotifications();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, notifications as never);
    const customerId = seed(prisma, { logoLimit: 10 });

    const result = await service.consumeLogoDownload(customerId);

    expect(result).toEqual({ logosUsed: 1, logosRemaining: 9 });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('throws SUBSCRIPTION_LOGO_LIMIT_REACHED once the plan limit is hit', async () => {
    const prisma = createFakePrisma();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, fakeNotifications() as never);
    const customerId = seed(prisma, { logoLimit: 10, logosUsed: 10 });

    await expect(service.consumeLogoDownload(customerId)).rejects.toMatchObject({ code: 'SUBSCRIPTION_LOGO_LIMIT_REACHED' });
  });

  it('never throws or caps usage when the plan has no logoLimit (unlimited)', async () => {
    const prisma = createFakePrisma();
    const notifications = fakeNotifications();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, notifications as never);
    const customerId = seed(prisma, { logoLimit: null, logosUsed: 999 });

    const result = await service.consumeLogoDownload(customerId);

    expect(result).toEqual({ logosUsed: 1000, logosRemaining: null });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it(`fires the low-balance notification exactly once, the first time remaining drops to ${LOW_LOGO_LIMIT_THRESHOLD}`, async () => {
    const prisma = createFakePrisma();
    const notifications = fakeNotifications();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, notifications as never);
    // limit=10, used=6 -> after this consume, used=7, remaining=3 (the threshold) -> should warn.
    const customerId = seed(prisma, { logoLimit: 10, logosUsed: 6 });

    const result = await service.consumeLogoDownload(customerId);

    expect(result).toEqual({ logosUsed: 7, logosRemaining: 3 });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'subscription_logo_limit_low', recipientUserId: customerId.toString() }));

    // A second consume (remaining now 2, still <= threshold) must NOT re-fire — logoLimitWarnedAt
    // already set from the first call, gating the re-fire until the next cycle's reset.
    notifications.notify.mockClear();
    await service.consumeLogoDownload(customerId);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('does not warn again if logoLimitWarnedAt was already set this cycle', async () => {
    const prisma = createFakePrisma();
    const notifications = fakeNotifications();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, notifications as never);
    const customerId = seed(prisma, { logoLimit: 10, logosUsed: 8, logoLimitWarnedAt: new Date() });

    await service.consumeLogoDownload(customerId);

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('rejects consuming for a customer with no active subscription', async () => {
    const prisma = createFakePrisma();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, fakeNotifications() as never);

    await expect(service.consumeLogoDownload(999n)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('deletePlan removes a plan that has never had a subscriber', async () => {
    const prisma = createFakePrisma();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, fakeNotifications() as never);
    prisma._plans.set('30', { id: 30n, name: 'Unused Plan', logoLimit: null });

    await service.deletePlan('30');

    expect(prisma._plans.has('30')).toBe(false);
  });

  it('deletePlan refuses to delete a plan with at least one subscriber, with a clear CONFLICT', async () => {
    const prisma = createFakePrisma();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, fakeNotifications() as never);
    seed(prisma, { logoLimit: 10 }); // plan id 10 now has a subscriber

    await expect(service.deletePlan('10')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma._plans.has('10')).toBe(true); // untouched
  });

  it('listAdminUsage reports used/remaining per subscriber across the whole customer base', async () => {
    const prisma = createFakePrisma();
    const service = new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never, fakeNotifications() as never);
    seed(prisma, { logoLimit: 10, logosUsed: 4 });

    const usage = await service.listAdminUsage();

    expect(usage).toEqual([
      expect.objectContaining({ customerEmail: 'customer@example.com', planName: 'Gold Plan', logoLimit: 10, logosUsed: 4, logosRemaining: 6 }),
    ]);
  });
});
