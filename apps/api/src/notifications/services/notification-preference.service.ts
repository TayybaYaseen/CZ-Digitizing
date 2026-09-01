import { Injectable } from '@nestjs/common';
import type { NotificationPreferenceDto } from '@czd/shared-types';
import { NotificationChannel, NotificationType } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CHANNELS } from '../notifications.constants';

// AC-9 — per-(user, notificationType, channel) opt-out layered on top of DEFAULT_CHANNELS.
// Absence of a row means default-enabled; a row only exists to record an explicit choice.
@Injectable()
export class NotificationPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  // Pure intersection: a caller/platform-routed channel can be suppressed by an opt-out, but a
  // customer can never add a channel the platform doesn't route that type to in the first place.
  async resolveEnabledChannels(userId: bigint, type: NotificationType, requestedChannels: NotificationChannel[]): Promise<NotificationChannel[]> {
    const allowed = requestedChannels.filter((channel) => DEFAULT_CHANNELS[type]?.includes(channel));
    if (allowed.length === 0) return [];

    const optOuts = await this.prisma.notificationPreference.findMany({
      where: { userId, notificationType: type, channel: { in: allowed }, enabled: false },
      select: { channel: true },
    });
    const disabled = new Set(optOuts.map((row) => row.channel));
    return allowed.filter((channel) => !disabled.has(channel));
  }

  // Full type×channel matrix for the platform's default routing table, with `enabled` computed —
  // so the frontend never needs to know the default-true rule itself (spec §5 preference center UI).
  async getMatrix(userId: bigint): Promise<NotificationPreferenceDto[]> {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const overrides = new Map(rows.map((row) => [`${row.notificationType}:${row.channel}`, row.enabled]));

    const matrix: NotificationPreferenceDto[] = [];
    for (const [type, channels] of Object.entries(DEFAULT_CHANNELS) as [NotificationType, NotificationChannel[]][]) {
      for (const channel of channels) {
        const enabled = overrides.get(`${type}:${channel}`) ?? true;
        matrix.push({ notificationType: type, channel, enabled });
      }
    }
    return matrix;
  }

  async upsertMany(userId: bigint, entries: { notificationType: NotificationType; channel: NotificationChannel; enabled: boolean }[]): Promise<void> {
    await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_notificationType_channel: { userId, notificationType: entry.notificationType, channel: entry.channel } },
          create: { userId, notificationType: entry.notificationType, channel: entry.channel, enabled: entry.enabled },
          update: { enabled: entry.enabled },
        }),
      ),
    );
  }
}
