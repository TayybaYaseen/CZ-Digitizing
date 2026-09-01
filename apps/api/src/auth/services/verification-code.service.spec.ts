import type { Session } from '../../generated/prisma';
import { VerificationCodeService } from './verification-code.service';
import { DEVICE_CODE_MAX_ATTEMPTS, RESET_CODE_MAX_ATTEMPTS } from '../auth.constants';

function createFakePrisma(initial: Partial<Session>) {
  let session: Partial<Session> = { verificationAttempts: 0, ...initial };
  return {
    session: {
      findUnique: jest.fn(async () => session),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const increment = data.verificationAttempts as { increment: number } | undefined;
        session = {
          ...session,
          ...data,
          verificationAttempts: increment ? (session.verificationAttempts ?? 0) + increment.increment : (data.verificationAttempts as number) ?? session.verificationAttempts,
        };
        return session;
      }),
    },
  };
}

function createFakeRedis() {
  const store = new Map<string, string>();
  return {
    client: {
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      pttl: jest.fn(async () => 600_000),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    },
  };
}

describe('VerificationCodeService — device verification (AC-3/AC-4)', () => {
  it('accepts the correct code within the attempt limit', async () => {
    const prisma = createFakePrisma({ id: 'session-1' });
    const service = new VerificationCodeService(prisma as never, createFakeRedis() as never);

    const code = await service.issueDeviceCode('session-1');
    await expect(service.verifyDeviceCode('session-1', code)).resolves.toBeUndefined();
  });

  it('rejects an incorrect code with INVALID_OR_EXPIRED_CODE (401)', async () => {
    const prisma = createFakePrisma({ id: 'session-1' });
    const service = new VerificationCodeService(prisma as never, createFakeRedis() as never);

    await service.issueDeviceCode('session-1');
    await expect(service.verifyDeviceCode('session-1', '0000')).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_CODE' });
  });

  it('returns RATE_LIMITED (429) after exceeding the attempt limit (AC-4)', async () => {
    const prisma = createFakePrisma({ id: 'session-1' });
    const service = new VerificationCodeService(prisma as never, createFakeRedis() as never);

    const code = await service.issueDeviceCode('session-1');
    const wrongCode = code === '0000' ? '1111' : '0000';
    for (let attempt = 0; attempt < DEVICE_CODE_MAX_ATTEMPTS - 1; attempt++) {
      await expect(service.verifyDeviceCode('session-1', wrongCode)).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_CODE' });
    }
    await expect(service.verifyDeviceCode('session-1', wrongCode)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    // Even the correct code is now refused until a new one is issued.
    await expect(service.verifyDeviceCode('session-1', code)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('VerificationCodeService — password reset (AC-6)', () => {
  it('accepts the correct reset code and is single-use once consumed', async () => {
    const redis = createFakeRedis();
    const service = new VerificationCodeService({} as never, redis as never);

    const code = await service.issueResetCode(9n);
    await expect(service.verifyResetCode(9n, code)).resolves.toBeUndefined();
    await service.consumeResetCode(9n);
    await expect(service.verifyResetCode(9n, code)).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_CODE' });
  });

  it('does not distinguish "no code issued" from "wrong code" (no email enumeration)', async () => {
    const service = new VerificationCodeService({} as never, createFakeRedis() as never);
    await expect(service.verifyResetCode(123n, '0000')).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_CODE' });
  });

  it('rate-limits after exceeding the attempt limit', async () => {
    const redis = createFakeRedis();
    const service = new VerificationCodeService({} as never, redis as never);

    const code = await service.issueResetCode(5n);
    const wrongCode = code === '0000' ? '1111' : '0000';
    for (let attempt = 0; attempt < RESET_CODE_MAX_ATTEMPTS - 1; attempt++) {
      await expect(service.verifyResetCode(5n, wrongCode)).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_CODE' });
    }
    await expect(service.verifyResetCode(5n, wrongCode)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
