import { DashboardService } from './dashboard.service';

function createFakePrisma(customers: { id: bigint; displayName: string | null; createdAt: Date }[] = []) {
  return { user: { findMany: jest.fn(async () => customers) } };
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

  it('recentOrders/monthlyRevenuePkr/topDesigns are documented empty stubs (A-013/A-006 still Blocked)', async () => {
    const service = new DashboardService(createFakePrisma() as never, createFakeNotifications() as never);
    const stats = await service.getStats({ sub: '1', role: 'admin', permissions: [] } as never);
    expect(stats.recentOrders).toEqual([]);
    expect(stats.monthlyRevenuePkr).toEqual([]);
    expect(stats.topDesigns).toEqual([]);
  });
});
