export interface DashboardStatsDto {
  // TODO(A-013): populate from the Orders table once that aspect exists (still Blocked per
  // docs/specs/SPEC_INDEX.md). Empty/zero until then — never fabricated.
  recentOrders: unknown[];
  monthlyRevenuePkr: { month: string; revenuePkr: number }[];
  // TODO(A-006): populate from the Designs table once that aspect exists (still Blocked).
  topDesigns: { designId: string; name: string; unitsSold: number }[];
  recentCustomers: { customerId: string; name: string | null; registeredAt: string }[];
  unreadNotificationCount: number;
  // AC-13 — sections a non-full-admin (freelancer/moderator) has at least read access to; a
  // full admin always sees every section.
  visibleSections: DashboardSection[];
}

export const DASHBOARD_SECTIONS = ['orders', 'revenue', 'designs', 'customers', 'notifications'] as const;
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

// Maps each dashboard widget to the AdminModule permission that gates it (AC-13). 'revenue' and
// 'customers' have no dedicated AdminModule of their own — revenue rides on 'orders' access
// (it's derived from order data), customers has no module gate and is always visible.
export const SECTION_PERMISSION_MODULE: Partial<Record<DashboardSection, string>> = {
  orders: 'orders',
  revenue: 'orders',
  designs: 'designs',
  notifications: 'notifications',
};
