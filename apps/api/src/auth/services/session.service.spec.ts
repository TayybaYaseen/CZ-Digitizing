import type { Session } from '../../generated/prisma';
import { SessionService } from './session.service';

function baseSession(overrides: Partial<Session>): Session {
  return {
    id: 'session-1',
    userId: 1n,
    deviceId: 'device-1',
    deviceInfo: null,
    ipAddress: null,
    userAgent: null,
    isVerified: true,
    verificationCodeHash: null,
    verificationAttempts: 0,
    verificationExpiresAt: null,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 1_000_000),
    revokedAt: null,
    ...overrides,
  };
}

function createFakePrisma(sessions: Session[]) {
  return {
    session: {
      findFirst: jest.fn(async ({ where }: { where: { userId: bigint; deviceId: string; isVerified?: boolean; revokedAt?: null } }) =>
        sessions.find((s) => s.userId === where.userId && s.deviceId === where.deviceId && s.isVerified === where.isVerified && s.revokedAt === null) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => sessions.find((s) => s.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Session> }) => {
        const session = sessions.find((s) => s.id === where.id)!;
        Object.assign(session, data);
        return session;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { userId: bigint; id?: { not: string } }; data: Partial<Session> }) => {
        const targets = sessions.filter((s) => s.userId === where.userId && (!where.id || s.id !== where.id.not));
        targets.forEach((s) => Object.assign(s, data));
        return { count: targets.length };
      }),
      findMany: jest.fn(async ({ where }: { where: { userId: bigint; deviceId?: { not: string } } }) =>
        sessions.filter((s) => s.userId === where.userId && s.isVerified && !s.revokedAt && (!where.deviceId || s.deviceId !== where.deviceId.not)),
      ),
      create: jest.fn(async ({ data }: { data: Partial<Session> }) => {
        const session = baseSession({ ...data, isVerified: false, expiresAt: null } as Partial<Session>);
        sessions.push(session);
        return session;
      }),
    },
  };
}

describe('SessionService — device trust (AC-2/AC-3)', () => {
  it('finds a verified, non-revoked, non-expired session for the same user+device', async () => {
    const sessions = [baseSession({})];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await expect(service.findTrustedSession(1n, 'device-1')).resolves.toMatchObject({ id: 'session-1' });
  });

  it('treats an unknown device as untrusted (AC-3)', async () => {
    const service = new SessionService(createFakePrisma([baseSession({})]) as never);
    await expect(service.findTrustedSession(1n, 'unknown-device')).resolves.toBeNull();
  });

  it('treats a session past its 30-day inactivity window as untrusted (AC-7)', async () => {
    const sessions = [baseSession({ expiresAt: new Date(Date.now() - 1000) })];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await expect(service.findTrustedSession(1n, 'device-1')).resolves.toBeNull();
  });

  it('treats a revoked session as untrusted regardless of expiry', async () => {
    const sessions = [baseSession({ revokedAt: new Date() })];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await expect(service.findTrustedSession(1n, 'device-1')).resolves.toBeNull();
  });
});

describe('SessionService — activity gating (AC-7)', () => {
  it('rejects refresh/verify-session for a revoked session', async () => {
    const sessions = [baseSession({ revokedAt: new Date() })];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await expect(service.getActiveSessionOrThrow('session-1')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects refresh/verify-session for an expired session', async () => {
    const sessions = [baseSession({ expiresAt: new Date(Date.now() - 1000) })];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await expect(service.getActiveSessionOrThrow('session-1')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('accepts and extends an active session', async () => {
    const sessions = [baseSession({})];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await expect(service.getActiveSessionOrThrow('session-1')).resolves.toMatchObject({ id: 'session-1' });
  });
});

describe('SessionService — revocation (AC-6/AC-8)', () => {
  it('revokeAllForUser revokes every session for that user', async () => {
    const sessions = [baseSession({ id: 'a' }), baseSession({ id: 'b' })];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await service.revokeAllForUser(1n);
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('revokeAllForUser can exclude the current session', async () => {
    const sessions = [baseSession({ id: 'a' }), baseSession({ id: 'b' })];
    const service = new SessionService(createFakePrisma(sessions) as never);
    await service.revokeAllForUser(1n, 'a');
    expect(sessions.find((s) => s.id === 'a')!.revokedAt).toBeNull();
    expect(sessions.find((s) => s.id === 'b')!.revokedAt).not.toBeNull();
  });
});
