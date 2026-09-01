import { NotificationPreferenceService } from './notification-preference.service';

function createFakePrisma(rows: { userId: bigint; notificationType: string; channel: string; enabled: boolean }[] = []) {
  return {
    notificationPreference: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => {
          if (where.userId !== undefined && r.userId !== where.userId) return false;
          if (where.notificationType !== undefined && r.notificationType !== where.notificationType) return false;
          if (where.enabled !== undefined && r.enabled !== where.enabled) return false;
          return true;
        }),
      ),
      upsert: jest.fn(async ({ create }: { create: (typeof rows)[number] }) => {
        rows.push(create);
        return create;
      }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('NotificationPreferenceService (AC-9)', () => {
  it('defaults every platform-routed channel to enabled when no preference row exists', async () => {
    const service = new NotificationPreferenceService(createFakePrisma() as never);
    const channels = await service.resolveEnabledChannels(1n, 'order_confirmed', ['email', 'whatsapp', 'in_app']);
    expect(channels).toEqual(['email', 'whatsapp', 'in_app']);
  });

  it('excludes a channel the user has explicitly opted out of', async () => {
    const prisma = createFakePrisma([{ userId: 1n, notificationType: 'order_confirmed', channel: 'whatsapp', enabled: false }]);
    const service = new NotificationPreferenceService(prisma as never);
    const channels = await service.resolveEnabledChannels(1n, 'order_confirmed', ['email', 'whatsapp', 'in_app']);
    expect(channels).toEqual(['email', 'in_app']);
  });

  it('never expands beyond the platform default routing table for a type (AC-9 "independent of platform-wide routing")', async () => {
    // admin_alert only ever routes to in_app per DEFAULT_CHANNELS — a caller mistakenly passing
    // 'sms' must never be granted just because no opt-out row exists for it.
    const service = new NotificationPreferenceService(createFakePrisma() as never);
    const channels = await service.resolveEnabledChannels(1n, 'admin_alert', ['in_app', 'sms']);
    expect(channels).toEqual(['in_app']);
  });

  it('computes the full type×channel matrix with enabled defaulted true when no row exists', async () => {
    const service = new NotificationPreferenceService(createFakePrisma() as never);
    const matrix = await service.getMatrix(1n);
    const orderConfirmedEmail = matrix.find((m) => m.notificationType === 'order_confirmed' && m.channel === 'email');
    expect(orderConfirmedEmail).toEqual({ notificationType: 'order_confirmed', channel: 'email', enabled: true });
  });

  it('reflects an explicit opt-out in the matrix', async () => {
    const prisma = createFakePrisma([{ userId: 1n, notificationType: 'order_confirmed', channel: 'email', enabled: false }]);
    const service = new NotificationPreferenceService(prisma as never);
    const matrix = await service.getMatrix(1n);
    const orderConfirmedEmail = matrix.find((m) => m.notificationType === 'order_confirmed' && m.channel === 'email');
    expect(orderConfirmedEmail?.enabled).toBe(false);
  });
});
