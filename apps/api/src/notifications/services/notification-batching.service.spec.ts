import { NotificationBatchingService } from './notification-batching.service';

function createFakeConfig(values: Record<string, unknown> = {}) {
  return { get: (key: string) => values[key] };
}

describe('NotificationBatchingService', () => {
  it('aggregates pending order_status_change notifications into one digest email per admin, then marks them batched', async () => {
    const pending = [
      { id: 1n, recipientUserId: 10n, title: 'Order #1 shipped', recipient: { id: 10n, email: 'admin@example.com' } },
      { id: 2n, recipientUserId: 10n, title: 'Order #2 delivered', recipient: { id: 10n, email: 'admin@example.com' } },
    ];
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue(pending),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const emailService = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationBatchingService(prisma as never, emailService as never, {} as never, createFakeConfig() as never);

    await service.sendOrderStatusDigest();

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@example.com' }));
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [1n, 2n] } }, data: { batchedAt: expect.any(Date) } }),
    );
  });

  it('sends nothing when there are no pending order_status_change notifications', async () => {
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() } };
    const emailService = { send: jest.fn() };
    const service = new NotificationBatchingService(prisma as never, emailService as never, {} as never, createFakeConfig() as never);

    await service.sendOrderStatusDigest();

    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('skips the hourly registration digest when NOTIFY_REGISTRATION_BATCH_ENABLED is not set (architecture: "if enabled")', async () => {
    const prisma = { user: { findMany: jest.fn(), count: jest.fn() } };
    const emailService = { send: jest.fn() };
    const service = new NotificationBatchingService(prisma as never, emailService as never, {} as never, createFakeConfig({ NOTIFY_REGISTRATION_BATCH_ENABLED: false }) as never);

    await service.sendRegistrationDigest();

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('sends the hourly registration digest to every admin when enabled and there are new registrations', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 1n, email: 'admin@example.com' }]),
        count: jest.fn().mockResolvedValue(3),
      },
    };
    const emailService = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationBatchingService(prisma as never, emailService as never, {} as never, createFakeConfig({ NOTIFY_REGISTRATION_BATCH_ENABLED: true }) as never);

    await service.sendRegistrationDigest();

    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@example.com', title: expect.stringContaining('3 new registrations') }));
  });

  // CZ_DIGITIZING_ARCHITECTURE.md § Notifications System, trigger 8 — 1-day-before-expiry reminder.
  // Previously a TODO(A-015) stub; A-015 is now Completed and CustomerSubscription.renewalDate
  // already exists, so this is no longer blocked.
  describe('sendSubscriptionRenewalReminders', () => {
    it('notifies a customer whose active, auto-renewing subscription renews within the next 24h', async () => {
      const prisma = {
        customerSubscription: {
          findMany: jest.fn().mockResolvedValue([
            { customerId: 5n, renewalDate: new Date(), plan: { name: 'Pro' } },
          ]),
        },
      };
      const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
      const service = new NotificationBatchingService(prisma as never, {} as never, notifications as never, createFakeConfig() as never);

      await service.sendSubscriptionRenewalReminders();

      expect(prisma.customerSubscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'active', autoRenew: true }) }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: '5', type: 'subscription_renewal' }),
      );
    });

    it('notifies no one when nothing renews in the next 24h', async () => {
      const prisma = { customerSubscription: { findMany: jest.fn().mockResolvedValue([]) } };
      const notifications = { notify: jest.fn() };
      const service = new NotificationBatchingService(prisma as never, {} as never, notifications as never, createFakeConfig() as never);

      await service.sendSubscriptionRenewalReminders();

      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });
});
