import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/token.types';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { DASHBOARD_SECTIONS, SECTION_PERMISSION_MODULE, type DashboardSection, type DashboardStatsDto } from './dto/dashboard-stats.dto';

const RECENT_CUSTOMERS_LIMIT = 5;

// docs/specs/2026-08-28-03-admin-platform-settings.md §3/§4 (aspect A-005d). No new tables —
// a read-only composition over existing entities (spec §4). recentOrders/monthlyRevenuePkr/
// topDesigns are documented stubs: `orders`/`designs` don't exist yet (A-013/A-006 still
// Blocked per docs/specs/SPEC_INDEX.md) — real data ships once those aspects land.
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async getStats(admin: AccessTokenPayload): Promise<DashboardStatsDto> {
    const [recentCustomers, unreadNotificationCount] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'customer' },
        orderBy: { createdAt: 'desc' },
        take: RECENT_CUSTOMERS_LIMIT,
        select: { id: true, displayName: true, createdAt: true },
      }),
      this.notifications.unreadCount(BigInt(admin.sub)),
    ]);

    return {
      recentOrders: [],
      monthlyRevenuePkr: [],
      topDesigns: [],
      recentCustomers: recentCustomers.map((c) => ({
        customerId: c.id.toString(),
        name: c.displayName,
        registeredAt: c.createdAt.toISOString(),
      })),
      unreadNotificationCount,
      visibleSections: this.resolveVisibleSections(admin),
    };
  }

  // AC-13 — role=admin sees every section; freelancer/moderator see only sections whose gating
  // module they hold at least read_only on (or that have no module gate at all).
  private resolveVisibleSections(admin: AccessTokenPayload): DashboardSection[] {
    if (admin.role === 'admin') return [...DASHBOARD_SECTIONS];

    const grantedModules = new Set(admin.permissions.map((p) => p.split(':')[0]));
    return DASHBOARD_SECTIONS.filter((section) => {
      const requiredModule = SECTION_PERMISSION_MODULE[section];
      return !requiredModule || grantedModules.has(requiredModule);
    });
  }
}
