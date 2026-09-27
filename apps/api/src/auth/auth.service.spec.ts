import { AuthService } from './auth.service';

// Notification-fix audit — "new_registration duplication" is called out explicitly as the highest
// risk to verify: CZ_DIGITIZING_ARCHITECTURE.md describes this trigger as "Delay: Hourly batch (if
// enabled)", i.e. the digest (NotificationBatchingService.sendRegistrationDigest(), same
// NOTIFY_REGISTRATION_BATCH_ENABLED flag) is the ALTERNATIVE delivery mode for this trigger, not an
// addition on top of the real-time one — so register() must never fire its own real-time Admin
// notification when that flag is on, or an operator enabling the batch would get both a real-time
// entry per signup AND the hourly summary re-listing the same registrations. This instantiates
// AuthService directly (same pattern as quotes.service.spec.ts/contact.service.spec.ts) with every
// dependency `register()` doesn't touch left as an empty stub, rather than booting the full Nest
// app just to flip one boot-time config value.
function createFakes(registrationBatchEnabled: boolean) {
  const admins = [{ id: 1n }, { id: 2n }];
  const prisma = {
    user: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 99n,
        email: data.email,
        displayName: data.displayName ?? null,
        role: 'customer',
        gmailVerified: false,
      })),
      findMany: jest.fn(async () => admins),
    },
    quote: { updateMany: jest.fn(async () => ({ count: 0 })) },
  };
  const passwords = { hash: jest.fn(async () => 'hashed') };
  const tokens = { signEmailVerificationToken: jest.fn(() => 'verify-token') };
  const codes = { issueEmailCode: jest.fn(async () => '1234') };
  const email = { send: jest.fn(async () => undefined) };
  const notifications = { notify: jest.fn(async () => undefined) };
  const config = { get: (key: string) => (key === 'NOTIFY_REGISTRATION_BATCH_ENABLED' ? registrationBatchEnabled : 'http://localhost') };

  const service = new AuthService(
    prisma as never,
    passwords as never,
    tokens as never,
    {} as never, // sessions — unused by register()
    codes as never,
    {} as never, // totp — unused by register()
    {} as never, // oauth — unused by register()
    {} as never, // magicLink — unused by register()
    email as never,
    notifications as never,
    config as never,
  );
  return { service, prisma, notifications };
}

describe('AuthService.register — new_registration duplication guard', () => {
  it('fires the real-time Admin notification when the hourly batch is OFF (default)', async () => {
    const { service, notifications } = createFakes(false);

    await service.register({ email: 'new@example.com', password: 'password123' });

    expect(notifications.notify).toHaveBeenCalledTimes(2); // one per admin
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: '1', type: 'new_registration' }));
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: '2', type: 'new_registration' }));
  });

  it('does NOT fire the real-time Admin notification when the hourly batch is ON — the digest is the sole signal, avoiding a duplicate', async () => {
    const { service, notifications, prisma } = createFakes(true);

    await service.register({ email: 'new@example.com', password: 'password123' });

    expect(notifications.notify).not.toHaveBeenCalled();
    // Confirms the gate short-circuits before even looking up admins — not just "notify() happened
    // to no-op" for some other reason.
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
