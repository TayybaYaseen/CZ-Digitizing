import { Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { ApiException } from '../../common/exceptions/api-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  DEVICE_CODE_MAX_ATTEMPTS,
  DEVICE_CODE_TTL_MS,
  RESET_CODE_MAX_ATTEMPTS,
  RESET_CODE_TTL_MS,
} from '../auth.constants';

interface ResetCodeRecord {
  hash: string;
  attempts: number;
}

// Shared 4-digit-code mechanics for two flows with different storage, per what each is
// naturally tied to:
//  - device verification (AC-3/AC-4) lives on the pending `sessions` row created at login
//  - forgot-password (AC-6) has no session context, so it lives in Redis keyed by user id —
//    a TTL there also satisfies the spec §4 retention rule ("codes purged after use or expiry")
//    for free.
// Both paths return INVALID_OR_EXPIRED_CODE for wrong/expired/unknown, never distinguishing
// "no such code" from "wrong code" (AC-6's no-email-enumeration rule).
@Injectable()
export class VerificationCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private generateCode(): string {
    return String(randomInt(0, 10_000)).padStart(4, '0');
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async issueDeviceCode(sessionId: string): Promise<string> {
    const code = this.generateCode();
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        verificationCodeHash: this.hash(code),
        verificationAttempts: 0,
        verificationExpiresAt: new Date(Date.now() + DEVICE_CODE_TTL_MS),
      },
    });
    return code;
  }

  async verifyDeviceCode(sessionId: string, code: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session?.verificationCodeHash || !session.verificationExpiresAt) {
      throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');
    }
    if (session.verificationAttempts >= DEVICE_CODE_MAX_ATTEMPTS || session.verificationExpiresAt.getTime() < Date.now()) {
      throw new ApiException('RATE_LIMITED', 429, 'Too many attempts — request a new code');
    }
    if (session.verificationCodeHash === this.hash(code)) return;

    const attempts = await this.prisma.session
      .update({ where: { id: sessionId }, data: { verificationAttempts: { increment: 1 } } })
      .then((s) => s.verificationAttempts);
    throw new ApiException(
      attempts >= DEVICE_CODE_MAX_ATTEMPTS ? 'RATE_LIMITED' : 'INVALID_OR_EXPIRED_CODE',
      attempts >= DEVICE_CODE_MAX_ATTEMPTS ? 429 : 401,
      attempts >= DEVICE_CODE_MAX_ATTEMPTS ? 'Too many attempts — request a new code' : 'Invalid or expired code',
    );
  }

  private resetKey(userId: bigint): string {
    return `auth:pwreset:${userId}`;
  }

  async issueResetCode(userId: bigint): Promise<string> {
    const code = this.generateCode();
    const record: ResetCodeRecord = { hash: this.hash(code), attempts: 0 };
    await this.redis.client.set(this.resetKey(userId), JSON.stringify(record), 'PX', RESET_CODE_TTL_MS);
    return code;
  }

  async verifyResetCode(userId: bigint, code: string): Promise<void> {
    const key = this.resetKey(userId);
    const raw = await this.redis.client.get(key);
    if (!raw) throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired code');

    const record = JSON.parse(raw) as ResetCodeRecord;
    if (record.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      throw new ApiException('RATE_LIMITED', 429, 'Too many attempts — request a new code');
    }
    if (record.hash === this.hash(code)) return;

    record.attempts += 1;
    const remainingTtl = await this.redis.client.pttl(key);
    await this.redis.client.set(key, JSON.stringify(record), 'PX', Math.max(remainingTtl, 1));
    throw new ApiException(
      record.attempts >= RESET_CODE_MAX_ATTEMPTS ? 'RATE_LIMITED' : 'INVALID_OR_EXPIRED_CODE',
      record.attempts >= RESET_CODE_MAX_ATTEMPTS ? 429 : 401,
      record.attempts >= RESET_CODE_MAX_ATTEMPTS ? 'Too many attempts — request a new code' : 'Invalid or expired code',
    );
  }

  consumeResetCode(userId: bigint): Promise<number> {
    return this.redis.client.del(this.resetKey(userId));
  }
}
