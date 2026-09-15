import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/token.types';
import { NotificationService } from '../notifications/services/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { DASHBOARD_SECTIONS, SECTION_PERMISSION_MODULE, type DashboardSection, type DashboardStatsDto } from './dto/dashboard-stats.dto';

const RECENT_CUSTOMERS_LIMIT = 5;
const RECENT_ORDERS_LIMIT = 5;
const TOP_DESIGNS_LIMIT = 5;
const REVENUE_MONTHS_BACK = 6;

// docs/specs/2026-08-28-03-admin-platform-settings.md §3/§4 (aspect A-005d). No new tables —
// a read-only composition over existing entities (spec §4): orders/order_items/designs/users.
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async getStats(admin: AccessTokenPayload): Promise<DashboardStatsDto> {
    const [recentCustomers, unreadNotificationCount, recentOrders, monthlyRevenuePkr, topDesigns] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'customer' },
        orderBy: { createdAt: 'desc' },
        take: RECENT_CUSTOMERS_LIMIT,
        select: { id: true, displayName: true, createdAt: true },
      }),
      this.notifications.unreadCount(BigInt(admin.sub)),
      this.getRecentOrders(),
      this.getMonthlyRevenue(),
      this.getTopDesigns(),
    ]);

    return {
      recentOrders,
      monthlyRevenuePkr,
      topDesigns,
      recentCustomers: recentCustomers.map((c) => ({
        customerId: c.id.toString(),
        name: c.displayName,
        registeredAt: c.createdAt.toISOString(),
      })),
      unreadNotificationCount,
      visibleSections: this.resolveVisibleSections(admin),
    };
  }

  private async getRecentOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: RECENT_ORDERS_LIMIT,
      select: {
        id: true,
        totalPkr: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        customer: { select: { displayName: true, email: true } },
      },
    });
    return orders.map((o) => ({
      orderId: o.id.toString(),
      customerName: o.customer.displayName ?? o.customer.email,
      totalPkr: Number(o.totalPkr),
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  // AC-12 — "monthly revenue": paid orders only (paymentStatus='completed'), bucketed by
  // calendar month, oldest-to-newest, with every month in the window present even at Rs 0 so a
  // chart never silently skips a slow month.
  private async getMonthlyRevenue() {
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    since.setMonth(since.getMonth() - (REVENUE_MONTHS_BACK - 1));

    const paidOrders = await this.prisma.order.findMany({
      where: { paymentStatus: 'completed', createdAt: { gte: since } },
      select: { totalPkr: true, createdAt: true },
    });

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const buckets = new Map<string, number>();
    for (let i = 0; i < REVENUE_MONTHS_BACK; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      buckets.set(monthKey(d), 0);
    }
    for (const order of paidOrders) {
      const key = monthKey(order.createdAt);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(order.totalPkr));
    }
    return [...buckets.entries()].map(([month, revenuePkr]) => ({ month, revenuePkr }));
  }

  // AC-12 — "top-selling designs": units sold across paid orders only, design-line-items only
  // (bundle/quote/custom-request lines carry no designId and are excluded, same as this DTO's
  // "top-selling designs" wording implies — a design, not a bundle or one-off custom job).
  private async getTopDesigns() {
    const items = await this.prisma.orderItem.findMany({
      where: { designId: { not: null }, order: { paymentStatus: 'completed' } },
      select: { designId: true, quantity: true, design: { select: { name: true } } },
    });
    const totals = new Map<string, { name: string; unitsSold: number }>();
    for (const item of items) {
      const key = item.designId!.toString();
      const existing = totals.get(key);
      totals.set(key, { name: item.design!.name, unitsSold: (existing?.unitsSold ?? 0) + item.quantity });
    }
    return [...totals.entries()]
      .map(([designId, v]) => ({ designId, name: v.name, unitsSold: v.unitsSold }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, TOP_DESIGNS_LIMIT);
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
