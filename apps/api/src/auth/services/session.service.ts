import { Injectable } from '@nestjs/common';
import type { Session } from '../../generated/prisma';
import { ApiException } from '../../common/exceptions/api-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { SESSION_INACTIVITY_TTL_MS } from '../auth.constants';

export interface DeviceContext {
  deviceId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Owns the `sessions` table: device-trust lookups (AC-2/AC-3), the 30-day rolling inactivity
// window (AC-7), and revocation (AC-6/AC-8). Deliberately independent of the access token's own
// (short, stateless) lifetime — see apps/api/src/auth/token.types.ts.
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async findTrustedSession(userId: bigint, deviceId: string): Promise<Session | null> {
    const session = await this.prisma.session.findFirst({
      where: { userId, deviceId, isVerified: true, revokedAt: null },
      orderBy: { lastActivityAt: 'desc' },
    });
    if (!session || this.isExpired(session)) return null;
    return session;
  }

  async createUnverifiedSession(userId: bigint, device: DeviceContext): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        deviceId: device.deviceId,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        deviceInfo: { ipAddress: device.ipAddress ?? null, userAgent: device.userAgent ?? null },
        isVerified: false,
      },
    });
  }

  async markVerifiedAndExtend(sessionId: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isVerified: true,
        verificationCodeHash: null,
        verificationAttempts: 0,
        verificationExpiresAt: null,
        lastActivityAt: new Date(),
        expiresAt: this.nextExpiry(),
      },
    });
  }

  touch(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date(), expiresAt: this.nextExpiry() },
    });
  }

  async getActiveSessionOrThrow(sessionId: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || this.isExpired(session)) {
      throw new ApiException('UNAUTHENTICATED', 401, 'Session expired or revoked');
    }
    return session;
  }

  revoke(sessionId: string) {
    return this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  // AC-6 (password reset) and customer-facing "log out everywhere" (spec §8 risk #3, resolved
  // customer-facing here since AC-6 already requires the same primitive).
  revokeAllForUser(userId: bigint, exceptSessionId?: string) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null, id: exceptSessionId ? { not: exceptSessionId } : undefined },
      data: { revokedAt: new Date() },
    });
  }

  // AC-3 — "existing trusted sessions for the account receive a new-login notification".
  listOtherTrustedSessions(userId: bigint, excludeDeviceId: string) {
    return this.prisma.session.findMany({
      where: { userId, isVerified: true, revokedAt: null, deviceId: { not: excludeDeviceId } },
    });
  }

  private isExpired(session: Session): boolean {
    return session.expiresAt !== null && session.expiresAt.getTime() < Date.now();
  }

  private nextExpiry(): Date {
    return new Date(Date.now() + SESSION_INACTIVITY_TTL_MS);
  }
}
