'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StartSupportConversationResult, SupportContextType } from '@czd/shared-types';
import { BackArrow } from '@/components/DirectionalArrow';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useLocale } from '@/lib/locale-context';
import { authHeaders, contextLabel, newClientMessageId, publishSupportUnread } from '@/lib/support-chat';
import { SupportComposer } from './SupportComposer';
import { HeadsetIcon } from './SupportThread';
import { useVisualViewportHeight } from './useVisualViewportHeight';

interface Props {
  accessToken: string;
  contextType: SupportContextType;
  contextId: string | null;
  contextDisplay: string | null;
  onStarted: () => void;
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2/§13.3 — no conversation row exists until
// the first message is sent; starting from the same order/request again lands in the active one.
export function SupportNewConversation({ accessToken, contextType, contextId, contextDisplay, onStarted }: Props) {
  const router = useRouter();
  const { t, errorMessage } = useLocale();
  const vvh = useVisualViewportHeight();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept across retries so a re-send after a network failure is idempotent (§11.6).
  const [clientMessageId] = useState(newClientMessageId);

  async function start(body: string): Promise<boolean> {
    setSending(true);
    setError(null);
    try {
      const result = await apiFetch<StartSupportConversationResult>('/api/support/conversations', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ clientMessageId, body, contextType, ...(contextId ? { contextId } : {}) }),
      });
      onStarted();
      publishSupportUnread(0);
      router.replace(`/account/support/${result.conversation.id}`);
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.error.errors?.[0]?.message && err.error.code === 'VALIDATION_ERROR' ? err.error.errors[0].message : errorMessage(err.error)) : t('apiErrors.generic'));
      setSending(false);
      return false;
    }
  }

  const chip = contextType !== 'general' ? contextLabel(t, { type: contextType, id: contextId, label: contextDisplay ?? contextId }) : null;

  return (
    <section
      aria-labelledby="support-new-title"
      className="fixed inset-x-0 top-0 z-[60] flex h-[var(--support-vvh,100dvh)] flex-col bg-brand-lightGray md:static md:z-auto md:h-full"
      style={{ ['--support-vvh' as string]: vvh ? `${vvh}px` : undefined }}
    >
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2.5">
        <Link href="/account/support" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-navy hover:bg-gray-100 md:hidden" aria-label={t('supportChat.back')}>
          <BackArrow />
        </Link>
        <span aria-hidden="true" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy text-brand-gold">
          <HeadsetIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="support-new-title" className="truncate text-sm font-semibold text-brand-navy">
            {t('supportChat.teamName')}
          </h2>
          <p className="truncate text-xs text-gray-500">{t('supportChat.subtitle')}</p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 text-center">
        {chip && (
          <span className="rounded-full border border-brand-gold/60 bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-navy">
            <bdi>{chip}</bdi>
          </span>
        )}
        <p className="max-w-sm text-sm text-gray-600">{t('supportChat.howCanWeHelp')}</p>
      </div>
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className="bg-white">
        <SupportComposer onSend={start} disabled={sending} autoFocus error={error} />
      </div>
    </section>
  );
}
