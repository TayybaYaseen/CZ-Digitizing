import { Suspense } from 'react';
import { LiveChatInbox } from '@/components/support-chat/LiveChatInbox';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.4 — one conversation (also the
// support_message notification's click-through target).
export default function LiveChatConversationPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <LiveChatInbox selectedId={params.id} />
    </Suspense>
  );
}
