import { Suspense } from 'react';
import { SupportChatShell } from '@/components/support-chat/SupportChatShell';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2 — one conversation (linkable; also the
// support_reply notification's click-through target).
export default function SupportConversationPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <SupportChatShell mode="thread" selectedId={params.id} />
    </Suspense>
  );
}
