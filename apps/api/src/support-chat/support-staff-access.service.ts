import { Injectable } from '@nestjs/common';
import type { AdminAccessLevel, Role } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §12 — the same rule AdminPermissionsGuard
// applies to REST routes, for the two places that can't use the guard: the socket gateway (connect +
// every join) and the notifier (who gets a support_message notification).
@Injectable()
export class SupportStaffAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async hasAccess(userId: bigint, role: Role | string, level: AdminAccessLevel = 'read_only'): Promise<boolean> {
    if (role === 'admin') return true;
    if (role !== 'freelancer' && role !== 'moderator') return false;
    const permission = await this.prisma.adminPermission.findFirst({
      where: { userId, module: 'support_chat', revokedAt: null },
      select: { accessLevel: true },
    });
    return !!permission && (permission.accessLevel === 'crud' || level === 'read_only');
  }

  // Every active staff user who may read support conversations.
  async recipients(): Promise<{ id: bigint }[]> {
    return this.prisma.user.findMany({
      where: {
        status: 'active',
        OR: [
          { role: 'admin' },
          { role: { in: ['freelancer', 'moderator'] }, adminPermissions: { some: { module: 'support_chat', revokedAt: null } } },
        ],
      },
      select: { id: true },
    });
  }
}
