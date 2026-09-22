import { NotificationEmailService } from './notification-email.service';

function createFakeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    WEB_BASE_URL: 'http://localhost:3000',
    APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    ...overrides,
  };
  return { get: (key: string) => values[key] };
}

describe('NotificationEmailService (AC-5)', () => {
  it('sends an HTML branded email alongside the plain-text body via the shared EmailService', async () => {
    const emailService = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationEmailService(emailService as never, createFakeConfig() as never);

    await service.send({ to: 'c@example.com', userId: 10n, type: 'order_confirmed', title: 'Order confirmed', message: 'Thanks for your order' });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'c@example.com',
        subject: 'Order confirmed',
        text: 'Thanks for your order',
        html: expect.stringContaining('Order confirmed'),
      }),
    );
  });

  it('includes an unsubscribe link for a customer-facing type', async () => {
    const emailService = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationEmailService(emailService as never, createFakeConfig() as never);

    await service.send({ to: 'c@example.com', userId: 10n, type: 'order_confirmed', title: 'Order confirmed', message: null });

    const call = emailService.send.mock.calls[0][0];
    expect(call.html).toContain('Unsubscribe');
  });

  it('omits the unsubscribe link for an admin-only alert type', async () => {
    const emailService = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationEmailService(emailService as never, createFakeConfig() as never);

    await service.send({ to: 'admin@example.com', userId: 1n, type: 'admin_alert', title: 'Disk almost full', message: null });

    const call = emailService.send.mock.calls[0][0];
    expect(call.html).not.toContain('Unsubscribe');
  });

  it.each(['admin', 'moderator', 'freelancer'] as const)('routes a %s recipient as an Admin-audience email', async (recipientRole) => {
    const emailService = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationEmailService(emailService as never, createFakeConfig() as never);

    await service.send({ to: 'staff@example.com', userId: 1n, type: 'contact_message', title: 'New contact form submission', message: 'hi', recipientRole });

    expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ audience: 'admin', subject: 'New contact form submission' }));
  });

  it('does not mark a customer recipient (or an unspecified role) as Admin-audience', async () => {
    const emailService = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationEmailService(emailService as never, createFakeConfig() as never);

    await service.send({ to: 'c@example.com', userId: 10n, type: 'order_confirmed', title: 'Order confirmed', message: null, recipientRole: 'customer' });
    await service.send({ to: 'c@example.com', userId: 10n, type: 'order_confirmed', title: 'Order confirmed', message: null });

    for (const [arg] of emailService.send.mock.calls) expect(arg).not.toHaveProperty('audience');
  });
});
