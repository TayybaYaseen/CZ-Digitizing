import { NotificationDispatchService } from './notification-dispatch.service';

function createFakePrisma() {
  const logs: { id: number; channel: string; status: string; providerMessageId?: string }[] = [];
  let nextId = 1;
  return {
    logs,
    notificationDeliveryLog: {
      create: jest.fn(async ({ data }: { data: { channel: string; status: string } }) => {
        const row = { id: nextId++, ...data };
        logs.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: number }; data: Partial<(typeof logs)[number]> }) => {
        const row = logs.find((l) => l.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };
}

const notification = { id: 1n, notificationType: 'order_confirmed', title: 'Order confirmed', message: 'Thanks!' } as never;
const recipientBase = { id: 10n, email: 'customer@example.com', phone: '+15551234567' };
const recipient = recipientBase as never;

describe('NotificationDispatchService', () => {
  it('marks a channel sent when its send succeeds', async () => {
    const prisma = createFakePrisma();
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    const dispatch = new NotificationDispatchService(prisma as never, email as never, {} as never, {} as never, {} as never);

    await dispatch.dispatchAll(notification, recipient, ['email']);

    expect(prisma.logs).toEqual([expect.objectContaining({ channel: 'email', status: 'sent' })]);
  });

  it('marks a channel failed without throwing, and does not affect sibling channels (channel isolation)', async () => {
    const prisma = createFakePrisma();
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    const whatsapp = { send: jest.fn().mockRejectedValue(new Error('not configured')) };
    const dispatch = new NotificationDispatchService(prisma as never, email as never, whatsapp as never, {} as never, {} as never);

    const outcomes = await dispatch.dispatchAll(notification, recipient, ['email', 'whatsapp']);
    expect(outcomes).toEqual({ email: true, whatsapp: false });

    const byChannel = Object.fromEntries(prisma.logs.map((l) => [l.channel, l.status]));
    expect(byChannel).toEqual({ email: 'sent', whatsapp: 'failed' });
  });

  it('records in_app as sent with no external call (the Notification row itself is the delivery)', async () => {
    const prisma = createFakePrisma();
    const dispatch = new NotificationDispatchService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await dispatch.dispatchAll(notification, recipient, ['in_app']);

    expect(prisma.logs).toEqual([expect.objectContaining({ channel: 'in_app', status: 'sent' })]);
  });

  it('fails whatsapp/sms when the recipient has no phone on file', async () => {
    const prisma = createFakePrisma();
    const dispatch = new NotificationDispatchService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await dispatch.dispatchAll(notification, { ...recipientBase, phone: null } as never, ['whatsapp']);

    expect(prisma.logs).toEqual([expect.objectContaining({ channel: 'whatsapp', status: 'failed' })]);
  });

  // AC-5 — email retries with exponential backoff on transient failure.
  it('retries email up to 3 attempts total and marks sent once a retry succeeds', async () => {
    const prisma = createFakePrisma();
    const email = {
      send: jest
        .fn()
        .mockRejectedValueOnce(new Error('transient SMTP error'))
        .mockRejectedValueOnce(new Error('transient SMTP error'))
        .mockResolvedValueOnce(undefined),
    };
    const dispatch = new NotificationDispatchService(prisma as never, email as never, {} as never, {} as never, {} as never);

    const outcomes = await dispatch.dispatchAll(notification, recipient, ['email']);

    expect(outcomes).toEqual({ email: true });
    expect(email.send).toHaveBeenCalledTimes(3);
    expect(prisma.logs).toEqual([expect.objectContaining({ channel: 'email', status: 'sent' })]);
  }, 10_000);

  it('marks email failed only after exhausting all retry attempts', async () => {
    const prisma = createFakePrisma();
    const email = { send: jest.fn().mockRejectedValue(new Error('permanently down')) };
    const dispatch = new NotificationDispatchService(prisma as never, email as never, {} as never, {} as never, {} as never);

    const outcomes = await dispatch.dispatchAll(notification, recipient, ['email']);

    expect(outcomes).toEqual({ email: false });
    expect(email.send).toHaveBeenCalledTimes(3);
    expect(prisma.logs).toEqual([expect.objectContaining({ channel: 'email', status: 'failed' })]);
  }, 10_000);

  it('does not retry non-email channels (single attempt only)', async () => {
    const prisma = createFakePrisma();
    const whatsapp = { send: jest.fn().mockRejectedValue(new Error('down')) };
    const dispatch = new NotificationDispatchService(prisma as never, {} as never, whatsapp as never, {} as never, {} as never);

    await dispatch.dispatchAll(notification, recipient, ['whatsapp']);

    expect(whatsapp.send).toHaveBeenCalledTimes(1);
  });
});
