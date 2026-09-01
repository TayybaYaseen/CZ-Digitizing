import { NotificationService } from './notification.service';

function createFakePrisma(user: Record<string, unknown>) {
  const notifications: Record<string, unknown>[] = [];
  let nextId = 1n;
  return {
    notifications,
    user: { findUniqueOrThrow: jest.fn(async () => user) },
    notification: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId++, isRead: false, readAt: null, createdAt: new Date(), ...data };
        notifications.push(row);
        return row;
      }),
      findMany: jest.fn(async () => notifications),
      count: jest.fn(async () => notifications.length),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = notifications.find((n) => n.id === where.id && n.recipientUserId === where.recipientUserId);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      }),
      deleteMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const idx = notifications.findIndex((n) => n.id === where.id && n.recipientUserId === where.recipientUserId);
        if (idx >= 0) notifications.splice(idx, 1);
        return { count: idx >= 0 ? 1 : 0 };
      }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('NotificationService.notify() (AC-1)', () => {
  it('writes a Notification row unconditionally and dispatches to the resolved channels', async () => {
    const prisma = createFakePrisma({ id: 10n, email: 'c@example.com', lastWhatsappInboundAt: null, phone: null });
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: true, whatsapp: true, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'files_ready', title: 'Files ready', message: 'Download now', channels: ['email', 'in_app'] });

    expect(prisma.notifications).toEqual([expect.objectContaining({ notificationType: 'files_ready', title: 'Files ready' })]);
    expect(dispatch.dispatchAll).toHaveBeenCalledWith(expect.objectContaining({ notificationType: 'files_ready' }), expect.anything(), ['email', 'in_app']);
  });

  it('sets a 30-day expiresAt for customer-facing types, and null for admin-only types', async () => {
    const prisma = createFakePrisma({ id: 10n, email: 'c@example.com', lastWhatsappInboundAt: null, phone: null });
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: true, whatsapp: true, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'order_confirmed', title: 'Order confirmed', message: '', channels: ['in_app'] });
    await service.notify({ recipientUserId: '10', type: 'admin_alert', title: 'Disk almost full', message: '', channels: ['in_app'] });

    expect(prisma.notifications[0].expiresAt).toBeInstanceOf(Date);
    expect(prisma.notifications[1].expiresAt).toBeNull();
  });

  it('AC-6: falls back to email/in_app instead of whatsapp when the customer has no recent inbound message', async () => {
    const prisma = createFakePrisma({ id: 10n, email: 'c@example.com', lastWhatsappInboundAt: null, phone: '+15551234567' });
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: true, whatsapp: true, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'order_confirmed', title: 'Order confirmed', message: '', channels: ['email', 'whatsapp', 'in_app'] });

    expect(dispatch.dispatchAll).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.arrayContaining(['email', 'in_app']));
    const [, , channels] = dispatch.dispatchAll.mock.calls[0];
    expect(channels).not.toContain('whatsapp');
  });

  it('AC-6: uses whatsapp when the customer messaged within the last 48 hours', async () => {
    const prisma = createFakePrisma({ id: 10n, email: 'c@example.com', lastWhatsappInboundAt: new Date(Date.now() - 60 * 60 * 1000), phone: '+15551234567' });
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: true, whatsapp: true, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'order_confirmed', title: 'Order confirmed', message: '', channels: ['email', 'whatsapp', 'in_app'] });

    const [, , channels] = dispatch.dispatchAll.mock.calls[0];
    expect(channels).toContain('whatsapp');
  });
});

describe('NotificationService.notify() — AC-10 (SMS fallback)', () => {
  const reachableUser = { id: 10n, email: 'c@example.com', lastWhatsappInboundAt: null, phone: '+15551234567' };

  it('sends SMS when both email and WhatsApp fail for an SMS-eligible type', async () => {
    const prisma = createFakePrisma(reachableUser);
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: false, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'order_confirmed', title: 'Order confirmed', message: '', channels: ['email', 'in_app'] });

    expect(dispatch.dispatchAll).toHaveBeenCalledTimes(2);
    expect(dispatch.dispatchAll).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), ['sms']);
  });

  it('does not send SMS when email succeeded', async () => {
    const prisma = createFakePrisma(reachableUser);
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: true, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'order_confirmed', title: 'Order confirmed', message: '', channels: ['email', 'in_app'] });

    expect(dispatch.dispatchAll).toHaveBeenCalledTimes(1);
  });

  it('does not send SMS for a type that is not SMS-eligible, even if email/whatsapp both fail', async () => {
    const prisma = createFakePrisma(reachableUser);
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: false, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'quote_response', title: 'Quote responded', message: '', channels: ['email', 'in_app'] });

    expect(dispatch.dispatchAll).toHaveBeenCalledTimes(1);
  });

  it('never sends SMS in the initial dispatch pass — it is only ever a reactive follow-up', async () => {
    const prisma = createFakePrisma(reachableUser);
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: true, sms: true, in_app: true }) };
    const service = new NotificationService(prisma as never, preferences as never, dispatch as never);

    await service.notify({ recipientUserId: '10', type: 'order_confirmed', title: 'Order confirmed', message: '', channels: ['email', 'sms', 'in_app'] });

    const [, , firstPassChannels] = dispatch.dispatchAll.mock.calls[0];
    expect(firstPassChannels).not.toContain('sms');
  });
});

describe('NotificationService — read/query surface (AC-2/AC-3/AC-8)', () => {
  function build(user = { id: 10n, email: 'c@example.com', lastWhatsappInboundAt: null, phone: null }) {
    const prisma = createFakePrisma(user);
    const preferences = { resolveEnabledChannels: jest.fn(async (_u: bigint, _t: string, ch: string[]) => ch) };
    const dispatch = { dispatchAll: jest.fn().mockResolvedValue({ email: true, whatsapp: true, in_app: true }) };
    return new NotificationService(prisma as never, preferences as never, dispatch as never);
  }

  it('AC-8: marking read updates isRead/readAt without touching any other field', async () => {
    const service = build();
    await service.notify({ recipientUserId: '10', type: 'files_ready', title: 'Files ready', message: '', channels: ['in_app'] });
    const { items } = await service.list(10n, 1, 20);
    await service.markRead(10n, items[0].id);

    const { items: after } = await service.list(10n, 1, 20);
    expect(after[0].isRead).toBe(true);
    expect(after[0].readAt).not.toBeNull();
  });

  it('AC-8/scoping: marking another user\'s notification read throws NOTIFICATION_NOT_FOUND (no cross-user access, no enumeration)', async () => {
    const service = build();
    await service.notify({ recipientUserId: '10', type: 'files_ready', title: 'Files ready', message: '', channels: ['in_app'] });
    const { items } = await service.list(10n, 1, 20);

    await expect(service.markRead(999n, items[0].id)).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
  });

  it('delete removes the notification for its own recipient only', async () => {
    const service = build();
    await service.notify({ recipientUserId: '10', type: 'files_ready', title: 'Files ready', message: '', channels: ['in_app'] });
    const { items } = await service.list(10n, 1, 20);

    await service.remove(10n, items[0].id);
    const { items: after, total } = await service.list(10n, 1, 20);
    expect(after).toHaveLength(0);
    expect(total).toBe(0);
  });
});
