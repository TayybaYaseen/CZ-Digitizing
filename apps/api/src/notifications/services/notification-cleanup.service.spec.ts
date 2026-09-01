import { NotificationCleanupService } from './notification-cleanup.service';

describe('NotificationCleanupService (AC-3 — 30-day retention)', () => {
  it('deletes notifications whose expiresAt has passed', async () => {
    const prisma = { notification: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) } };
    const service = new NotificationCleanupService(prisma as never);

    await service.sweepExpired();

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: expect.any(Date) } } });
  });
});
