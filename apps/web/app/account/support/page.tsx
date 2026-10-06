import { Suspense } from 'react';
import { SupportChatShell } from '@/components/support-chat/SupportChatShell';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2 — "Chat with Support" (aspect A-025).
export default function SupportChatPage() {
  return (
    <Suspense fallback={null}>
      <SupportChatShell mode="list" />
    </Suspense>
  );
}
