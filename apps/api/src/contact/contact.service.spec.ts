import { ContactService } from './contact.service';

function createFakePrisma(admins: { id: bigint; role: string }[]) {
  const messages: Record<string, unknown>[] = [];
  return {
    contactMessage: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: BigInt(messages.length + 1), createdAt: new Date(), ...data };
        messages.push(row);
        return row;
      }),
    },
    user: {
      findMany: jest.fn(async ({ where }: { where: { role: string } }) => admins.filter((a) => a.role === where.role)),
    },
  };
}

describe('ContactService', () => {
  it('persists the message and notifies every admin (fan-out, matches QuotesService.notifyAdmins pattern)', async () => {
    const admins = [
      { id: 1n, role: 'admin' },
      { id: 2n, role: 'admin' },
      { id: 3n, role: 'freelancer' }, // not an admin — must not be notified
    ];
    const prisma = createFakePrisma(admins);
    const notify = jest.fn(async () => undefined);
    const service = new ContactService(prisma as never, { notify } as never);

    await service.submit({ name: 'Jane', email: 'jane@example.com', message: 'Hello there' });

    expect(prisma.contactMessage.create).toHaveBeenCalledWith({
      data: { name: 'Jane', email: 'jane@example.com', message: 'Hello there' },
    });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: '1', type: 'contact_message', channels: ['email', 'in_app'] }),
    );
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: '2', type: 'contact_message' }));
  });

  it('does nothing extra when there are no admin users (mirrors the zero-admins case in quotes.service.spec.ts)', async () => {
    const prisma = createFakePrisma([]);
    const notify = jest.fn(async () => undefined);
    const service = new ContactService(prisma as never, { notify } as never);

    await service.submit({ name: 'Jane', email: 'jane@example.com', message: 'Hello there' });

    expect(prisma.contactMessage.create).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
});
