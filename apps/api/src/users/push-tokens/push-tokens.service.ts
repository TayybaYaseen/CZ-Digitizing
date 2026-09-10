import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PushPlatform } from '../../generated/prisma';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §3/§4 (aspect A-023). One row per (user,
// device token); `token` is globally unique (an Expo/device push token identifies one
// installation), so "upsert on (user_id, token)" in practice means: if the token already exists
// (possibly for a different user — e.g. a shared/re-issued device), re-point it to the caller and
// refresh last_seen_at; otherwise create it fresh. Mirrors NotificationPreferenceService's
// upsert-by-unique-key shape.
@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: bigint, token: string, platform: PushPlatform) {
    return this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
  }

  // AC-13/§3 DELETE /api/users/push-token/:token — authenticated, own-token-only.
  async deregister(userId: bigint, token: string): Promise<void> {
    const existing = await this.prisma.pushToken.findUnique({ where: { token } });
    if (!existing) throw new NotFoundException('Push token not found');
    if (existing.userId !== userId) throw new ForbiddenException('Cannot remove another user\'s push token');
    await this.prisma.pushToken.delete({ where: { token } });
  }

  // Used by NotificationPushService to resolve delivery targets.
  async listTokensForUser(userId: bigint): Promise<{ token: string; platform: PushPlatform }[]> {
    return this.prisma.pushToken.findMany({ where: { userId }, select: { token: true, platform: true } });
  }
}
