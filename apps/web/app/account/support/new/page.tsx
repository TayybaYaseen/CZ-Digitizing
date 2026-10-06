import { Suspense } from 'react';
import { SupportChatShell } from '@/components/support-chat/SupportChatShell';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.1/§13.3 — start a conversation, optionally
// about an order/request: /account/support/new?context=order&id=1234
export default function NewSupportConversationPage() {
  return (
    <Suspense fallback={null}>
      <SupportChatShell mode="new" />
    </Suspense>
  );
}
