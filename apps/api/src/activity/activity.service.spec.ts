import { Prisma } from '../generated/prisma';
import { ActivityService } from './activity.service';

function createFakePrisma() {
  const rows: { idempotencyKey: string; id: bigint; customerId: bigint; createdAt: Date }[] = [];
  const keys = new Set<string>();
  return {
    activityEvent: {
      create: jest.fn(async ({ data }: { data: { idempotencyKey: string; customerId: bigint } }) => {
        if (keys.has(data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });
        }
        keys.add(data.idempotencyKey);
        // Monotonically increasing rather than `new Date()` — two calls in the same test can land
        // on the same millisecond, which would make the reverse-chronological ordering test flaky.
        const row = { id: BigInt(rows.length + 1), createdAt: new Date(Date.now() + rows.length), ...data } as (typeof rows)[number];
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where, skip, take }: { where: { customerId: bigint }; skip: number; take: number }) =>
        rows
          .filter((r) => r.customerId === where.customerId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + take),
      ),
      count: jest.fn(async ({ where }: { where: { customerId: bigint } }) => rows.filter((r) => r.customerId === where.customerId).length),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    _rows: rows,
  };
}

describe('ActivityService (AC-9–AC-15)', () => {
  it('records an event on first call (AC-9/AC-13)', async () => {
    const prisma = createFakePrisma();
    const service = new ActivityService(prisma as never);

    await service.record({ customerId: 1n, eventType: 'VIEWED', designId: 10n, source: 'web', idempotencyKey: '1:VIEWED:10:sess-1' });

    expect(prisma._rows).toHaveLength(1);
    expect(prisma._rows[0]).toMatchObject({ customerId: 1n, eventType: 'VIEWED', designId: 10n });
  });

  it('silently no-ops on a duplicate idempotency key instead of throwing (AC-15)', async () => {
    const prisma = createFakePrisma();
    const service = new ActivityService(prisma as never);
    const input = { customerId: 1n, eventType: 'VIEWED' as const, designId: 10n, source: 'web' as const, idempotencyKey: '1:VIEWED:10:sess-1' };

    await service.record(input);
    await expect(service.record(input)).resolves.toBeUndefined();

    expect(prisma._rows).toHaveLength(1);
  });

  it('records two events for the same customer+design under different idempotency keys (a real second view session)', async () => {
    const prisma = createFakePrisma();
    const service = new ActivityService(prisma as never);

    await service.record({ customerId: 1n, eventType: 'VIEWED', designId: 10n, source: 'web', idempotencyKey: '1:VIEWED:10:sess-1' });
    await service.record({ customerId: 1n, eventType: 'VIEWED', designId: 10n, source: 'web', idempotencyKey: '1:VIEWED:10:sess-2' });

    expect(prisma._rows).toHaveLength(2);
  });

  it('rethrows a non-P2002 error rather than swallowing it', async () => {
    const prisma = createFakePrisma() as unknown as { activityEvent: { create: jest.Mock } };
    prisma.activityEvent.create = jest.fn(async () => {
      throw new Error('connection lost');
    });
    const service = new ActivityService(prisma as never);

    await expect(
      service.record({ customerId: 1n, eventType: 'VIEWED', designId: 10n, source: 'web', idempotencyKey: '1:VIEWED:10:sess-1' }),
    ).rejects.toThrow('connection lost');
  });

  it('lists a customer\'s events reverse-chronologically (AC-13)', async () => {
    const prisma = createFakePrisma();
    const service = new ActivityService(prisma as never);
    await service.record({ customerId: 1n, eventType: 'VIEWED', designId: 10n, source: 'web', idempotencyKey: 'k1' });
    await service.record({ customerId: 1n, eventType: 'ADDED_TO_CART', designId: 10n, source: 'web', idempotencyKey: 'k2' });

    const { items, total } = await service.listForCustomer(1n, 1, 20);

    expect(total).toBe(2);
    expect(items.map((i) => i.eventType)).toEqual(['ADDED_TO_CART', 'VIEWED']);
  });
});
