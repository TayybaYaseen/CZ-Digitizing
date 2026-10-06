import type { NotificationService } from '../notifications/services/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import { SupportChatNotifierService } from './support-chat-notifier.service';
import { SupportPresenceService } from './support-presence.service';
import type { SupportStaffAccessService } from './support-staff-access.service';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §17.3 — duplicate suppression.
describe('SupportChatNotifierService', () => {
  const ctx = { conversationId: 7n, customerId: 3n, customerName: 'Ayesha', contextLabel: 'Order #12', preview: 'Is my file ready?' };
  let unread: Set<string>;
  let notify: jest.Mock;
  let presence: SupportPresenceService;
  let notifier: SupportChatNotifierService;

  beforeEach(() => {
    unread = new Set();
    notify = jest.fn(async (input: { recipientUserId: string; type: string }) => {
      unread.add(`${input.recipientUserId}:${input.type}`);
    });
    const prisma = {
      notification: {
        findFirst: jest.fn(async ({ where }: { where: { recipientUserId: bigint; notificationType: string } }) =>
          unread.has(`${where.recipientUserId}:${where.notificationType}`) ? { id: 1n } : null,
        ),
      },
    } as unknown as PrismaService;
    presence = new SupportPresenceService();
    const staff = { recipients: jest.fn(async () => [{ id: 100n }, { id: 101n }]) } as unknown as SupportStaffAccessService;
    notifier = new SupportChatNotifierService(prisma, { notify } as unknown as NotificationService, presence, staff);
  });

  it('notifies every permitted staff member once with admin channels and the conversation link', async () => {
    await notifier.customerWrote(ctx);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: '100',
        type: 'support_message',
        title: 'New support message from Ayesha (Order #12)',
        relatedSupportConversationId: '7',
        channels: ['email', 'in_app'],
      }),
    );
  });

  it('a burst of messages produces one notification per recipient until it is read', async () => {
    await Promise.all([notifier.customerWrote(ctx), notifier.customerWrote(ctx), notifier.customerWrote(ctx)]);
    expect(notify).toHaveBeenCalledTimes(2);

    unread.delete('100:support_message'); // admin 100 read it
    await notifier.customerWrote(ctx);
    expect(notify).toHaveBeenCalledTimes(3);
    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ recipientUserId: '100' }));
  });

  it('skips a recipient who is actively viewing the conversation', async () => {
    presence.register('sock-1', '3');
    presence.markJoined('sock-1', '7');
    presence.setViewing('sock-1', '7', true);
    await notifier.supportReplied(ctx);
    expect(notify).not.toHaveBeenCalled();

    presence.setViewing('sock-1', '7', false);
    await notifier.supportReplied(ctx);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: '3', type: 'support_reply', channels: ['email', 'in_app', 'push'] }));
  });

  it('a delivery failure is logged, never thrown', async () => {
    notify.mockRejectedValueOnce(new Error('smtp down'));
    await expect(notifier.supportReplied(ctx)).resolves.toBeUndefined();
  });
});
