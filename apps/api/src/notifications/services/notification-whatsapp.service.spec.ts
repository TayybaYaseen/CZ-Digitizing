import { NotificationWhatsappService } from './notification-whatsapp.service';

function createFakeConfig(values: Record<string, string> = {}) {
  return { get: (key: string) => values[key] };
}

describe('NotificationWhatsappService (AC-6)', () => {
  it('throws a clear "not configured" error when Twilio credentials are unset, rather than a raw network failure', async () => {
    const service = new NotificationWhatsappService(createFakeConfig() as never);
    await expect(service.send({ to: '+15551234567', title: 'Order confirmed', message: null })).rejects.toThrow(/not configured/);
  });
});
