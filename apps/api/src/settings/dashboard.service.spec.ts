import { DashboardService } from './dashboard.service';

interface FakeOrder {
  id: bigint;
  totalPkr: number;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  customer: { displayName: string | null; email: string };
}

interface FakeOrderItem {
  designId: bigint | null;
  quantity: number;
  design: { name: string } | null;
  order: { paymentStatus: string };
}

function createFakePrisma(
  customers: { id: bigint; displayName: string | null; createdAt: Date }[] = [],
  orders: FakeOrder[] = [],
  orderItems: FakeOrderItem[] = [],
) {
  return {
    user: { findMany: jest.fn(async () => customers) },
    order: {
      findMany: jest.fn(async ({ where }: { where?: { paymentStatus?: string; createdAt?: { gte: Date } } } = {}) => {
        let rows = [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        if (where?.paymentStatus) rows = rows.filter((o) => o.paymentStatus === where.paymentStatus);
        if (where?.createdAt?.gte) rows = rows.filter((o) => o.createdAt >= where.createdAt!.gte);
        return rows;
      }),
    },
    orderItem: {
      findMany: jest.fn(async ({ where }: { where?: { designId?: { not: null }; order?: { paymentStatus?: string } } } = {}) => {
        let rows = [...orderItems];
        if (where?.designId) rows = rows.filter((i) => i.designId !== null);
        if (where?.order?.paymentStatus) rows = rows.filter((i) => i.order.paymentStatus === where.order!.paymentStatus);
        return rows;
      }),
    },
  };
}

function createFakeNotifications(unread = 0) {
  return { unreadCount: jest.fn(async () => unread) };
}

describe('DashboardService (AC-12, AC-13)', () => {
  it('a full admin sees every dashboard section', async () => {
    const service = new DashboardService(createFakePrisma() as never, createFakeNotifications() as never);
    const admin = { sub: '1', role: 'admin', permissions: [] } as never;
    const stats = await service.getStats(admin);
    expect(stats.visibleSections).toEqual(['orders', 'revenue', 'designs', 'customers', 'notifications']);
  });

  it('a freelancer with only notifications:read_only sees notifications + customers only', async () => {
    const service = new DashboardService(createFakePrisma() as never, createFakeNotifications() as never);
    const freelancer = { sub: '2', role: 'freelancer', permissions: ['notifications:read_only'] } as never;
    const stats = await service.getStats(freelancer);
    expect(stats.visibleSections).toEqual(['customers', 'notifications']);
  });

  it('populates recentCustomers from users and unreadNotificationCount from NotificationService', async () => {
    const customers = [{ id: 5n, displayName: 'Jane', createdAt: new Date('2026-01-01') }];
    const service = new DashboardService(createFakePrisma(customers) as never, createFakeNotifications(3) as never);
    const stats = await service.getStats({ sub: '1', role: 'admin', permissions: [] } as never);
    expect(stats.recentCustomers).toEqual([{ customerId: '5', name: 'Jane', registeredAt: '2026-01-01T00:00:00.000Z' }]);
    expect(stats.unreadNotificationCount).toBe(3);
  });

  it('recentOrders/monthlyRevenuePkr/topDesigns are empty when there are no orders yet', async () => {
    const service = new DashboardService(createFakePrisma() as never, createFakeNotifications() as never);
    const stats = await service.getStats({ sub: '1', role: 'admin', permissions: [] } as never);
    expect(stats.recentOrders).toEqual([]);
    expect(stats.topDesigns).toEqual([]);
    expect(stats.monthlyRevenuePkr).toHaveLength(6); // every month in the window present, all Rs 0
    expect(stats.monthlyRevenuePkr.every((m) => m.revenuePkr === 0)).toBe(true);
  });

  it('populates recentOrders from real Order rows, newest first', async () => {
    const orders: FakeOrder[] = [
      { id: 1n, totalPkr: 1000, status: 'pending', paymentStatus: 'pending', createdAt: new Date('2026-09-01'), customer: { displayName: 'Amna', email: 'amna@x.com' } },
      { id: 2n, totalPkr: 2500, status: 'completed', paymentStatus: 'completed', createdAt: new Date('2026-09-10'), customer: { displayName: null, email: 'noname@x.com' } },
    ];
    const service = new DashboardService(createFakePrisma([], orders) as never, createFakeNotifications() as never);
    const stats = await service.getStats({ sub: '1', role: 'admin', permissions: [] } as never);
    expect(stats.recentOrders).toEqual([
      { orderId: '2', customerName: 'noname@x.com', totalPkr: 2500, status: 'completed', paymentStatus: 'completed', createdAt: '2026-09-10T00:00:00.000Z' },
      { orderId: '1', customerName: 'Amna', totalPkr: 1000, status: 'pending', paymentStatus: 'pending', createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
  });

  it('sums only completed-payment orders into monthlyRevenuePkr, ignoring pending/failed ones', async () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
    const monthKey = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
    const orders: FakeOrder[] = [
      { id: 1n, totalPkr: 1000, status: 'completed', paymentStatus: 'completed', createdAt: thisMonth, customer: { displayName: 'A', email: 'a@x.com' } },
      { id: 2n, totalPkr: 5000, status: 'completed', paymentStatus: 'completed', createdAt: thisMonth, customer: { displayName: 'B', email: 'b@x.com' } },
      { id: 3n, totalPkr: 9999, status: 'pending', paymentStatus: 'pending', createdAt: thisMonth, customer: { displayName: 'C', email: 'c@x.com' } },
    ];
    const service = new DashboardService(createFakePrisma([], orders) as never, createFakeNotifications() as never);
    const stats = await service.getStats({ sub: '1', role: 'admin', permissions: [] } as never);
    const bucket = stats.monthlyRevenuePkr.find((m) => m.month === monthKey);
    expect(bucket?.revenuePkr).toBe(6000); // 1000 + 5000, not the pending 9999
  });

  it('ranks topDesigns by units sold across completed-payment design line items only', async () => {
    const orderItems: FakeOrderItem[] = [
      { designId: 10n, quantity: 3, design: { name: 'Rose' }, order: { paymentStatus: 'completed' } },
      { designId: 11n, quantity: 6, design: { name: 'Lion' }, order: { paymentStatus: 'completed' } },
      { designId: 10n, quantity: 2, design: { name: 'Rose' }, order: { paymentStatus: 'completed' } },
      { designId: 12n, quantity: 100, design: { name: 'Ignored (unpaid)' }, order: { paymentStatus: 'pending' } },
      { designId: null, quantity: 1, design: null, order: { paymentStatus: 'completed' } }, // bundle/quote line
    ];
    const service = new DashboardService(createFakePrisma([], [], orderItems) as never, createFakeNotifications() as never);
    const stats = await service.getStats({ sub: '1', role: 'admin', permissions: [] } as never);
    expect(stats.topDesigns).toEqual([
      { designId: '11', name: 'Lion', unitsSold: 6 },
      { designId: '10', name: 'Rose', unitsSold: 5 },
    ]);
  });
});
