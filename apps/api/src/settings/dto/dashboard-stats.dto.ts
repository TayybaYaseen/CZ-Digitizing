export interface DashboardRecentOrderDto {
  orderId: string;
  customerName: string | null;
  totalPkr: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export interface DashboardStatsDto {
  // AC-12 — real orders.recentOrders/monthlyRevenuePkr/topDesigns, sourced from the Orders and
  // Design Catalog tables now that both A-013 and A-006 have shipped (see docs/specs/SPEC_INDEX.md's
  // incident note on this fix — this DTO's fields were left as documented stubs after both aspects
  // landed, so the Dashboard kept reporting "hasn't shipped" for a feature that had).
  recentOrders: DashboardRecentOrderDto[];
  monthlyRevenuePkr: { month: string; revenuePkr: number }[];
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
