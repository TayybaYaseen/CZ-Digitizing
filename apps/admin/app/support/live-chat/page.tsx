import { Suspense } from 'react';
import { LiveChatInbox } from '@/components/support-chat/LiveChatInbox';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.4 — Admin → Customer Support → Live Chat (A-025).
export default function LiveChatPage() {
  return (
    <Suspense fallback={null}>
      <LiveChatInbox selectedId={null} />
    </Suspense>
  );
}
