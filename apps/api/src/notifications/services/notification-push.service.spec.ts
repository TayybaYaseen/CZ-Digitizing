import { NotificationPushService } from './notification-push.service';

describe('NotificationPushService (AC-7 — stub, seam for A-023)', () => {
  it('throws a clear "not yet wired" error rather than silently succeeding', async () => {
    const service = new NotificationPushService();
    await expect(service.send({ userId: 10n, title: 'Files ready', message: null })).rejects.toThrow(/not yet wired/);
  });
});
