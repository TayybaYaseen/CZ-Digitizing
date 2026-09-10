import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PushTokensService } from './push-tokens.service';

function createFakePrisma(rows: { id: bigint; userId: bigint; token: string; platform: string; lastSeenAt: Date }[] = []) {
  let nextId = rows.length ? rows[rows.length - 1].id + 1n : 1n;
  return {
    pushToken: {
      upsert: jest.fn(async ({ where, create, update }: { where: { token: string }; create: Omit<(typeof rows)[number], 'id' | 'lastSeenAt'>; update: Partial<(typeof rows)[number]> }) => {
        const existing = rows.find((r) => r.token === where.token);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: nextId++, lastSeenAt: new Date(), ...create } as (typeof rows)[number];
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { token: string } }) => rows.find((r) => r.token === where.token) ?? null),
      delete: jest.fn(async ({ where }: { where: { token: string } }) => {
        const idx = rows.findIndex((r) => r.token === where.token);
        const [removed] = rows.splice(idx, 1);
        return removed;
      }),
      findMany: jest.fn(async ({ where }: { where: { userId: bigint } }) => rows.filter((r) => r.userId === where.userId)),
    },
  };
}

describe('PushTokensService (A-023, AC-13 registration half)', () => {
  it('creates a new push token row on first registration', async () => {
    const prisma = createFakePrisma();
    const service = new PushTokensService(prisma as never);
    const row = await service.register(1n, 'ExponentPushToken[aaa]', 'ios' as never);
    expect(row.userId).toBe(1n);
    expect(row.token).toBe('ExponentPushToken[aaa]');
  });

  it('is idempotent: registering the same token twice for the same user updates rather than duplicates', async () => {
    const prisma = createFakePrisma();
    const service = new PushTokensService(prisma as never);
    await service.register(1n, 'ExponentPushToken[aaa]', 'ios' as never);
    await service.register(1n, 'ExponentPushToken[aaa]', 'ios' as never);
    const tokens = await service.listTokensForUser(1n);
    expect(tokens).toHaveLength(1);
  });

  it('re-points a token to a new user when re-registered from a different account (device re-issue)', async () => {
    const prisma = createFakePrisma();
    const service = new PushTokensService(prisma as never);
    await service.register(1n, 'ExponentPushToken[shared]', 'android' as never);
    await service.register(2n, 'ExponentPushToken[shared]', 'android' as never);
    expect(await service.listTokensForUser(1n)).toHaveLength(0);
    expect(await service.listTokensForUser(2n)).toHaveLength(1);
  });

  it('deletes a token when the owning user requests it', async () => {
    const prisma = createFakePrisma();
    const service = new PushTokensService(prisma as never);
    await service.register(1n, 'ExponentPushToken[aaa]', 'ios' as never);
    await service.deregister(1n, 'ExponentPushToken[aaa]');
    expect(await service.listTokensForUser(1n)).toHaveLength(0);
  });

  it('refuses to delete another user\'s token (own-token-only guard)', async () => {
    const prisma = createFakePrisma();
    const service = new PushTokensService(prisma as never);
    await service.register(1n, 'ExponentPushToken[aaa]', 'ios' as never);
    await expect(service.deregister(2n, 'ExponentPushToken[aaa]')).rejects.toBeInstanceOf(ForbiddenException);
    expect(await service.listTokensForUser(1n)).toHaveLength(1);
  });

  it('404s deleting a token that does not exist', async () => {
    const prisma = createFakePrisma();
    const service = new PushTokensService(prisma as never);
    await expect(service.deregister(1n, 'ExponentPushToken[missing]')).rejects.toBeInstanceOf(NotFoundException);
  });
});
