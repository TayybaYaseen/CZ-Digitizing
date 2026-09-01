import { NotificationSmsService } from './notification-sms.service';

function createFakeConfig(values: Record<string, string> = {}) {
  return { get: (key: string) => values[key] };
}

describe('NotificationSmsService (AC-10)', () => {
  it('throws a clear "not configured" error when Twilio credentials are unset', async () => {
    const service = new NotificationSmsService(createFakeConfig() as never);
    await expect(service.send({ to: '+15551234567', title: 'Order confirmed', message: null })).rejects.toThrow(/not configured/);
  });
});
