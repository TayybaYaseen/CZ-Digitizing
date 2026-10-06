'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, SupportContextType, SupportConversationSummaryDto, SupportCustomerUnreadEvent } from '@czd/shared-types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { authHeaders, publishSupportUnread, useSupportSocket } from '@/lib/support-chat';
import { SupportConversationList } from './SupportConversationList';
import { SupportNewConversation } from './SupportNewConversation';
import { HeadsetIcon, SupportThread } from './SupportThread';

const CONTEXT_TYPES: SupportContextType[] = ['order', 'custom_request', 'quote', 'file_format_request'];

function upsert(list: SupportConversationSummaryDto[], row: SupportConversationSummaryDto): SupportConversationSummaryDto[] {
  const next = [row, ...list.filter((c) => c.id !== row.id)];
  return next.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : a.lastMessageAt > b.lastMessageAt ? -1 : 0));
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2, §23, §24 — "Chat with Support" for
// signed-in customers: conversation list + thread (two panes from md up, one pane on phones). The
// socket only exists while a customer is on these pages (§11.10).
export function SupportChatShell({ mode, selectedId }: { mode: 'list' | 'thread' | 'new'; selectedId?: string }) {
  const { user, accessToken, isReady } = useAuth();
  const { t } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCustomer = user?.role === 'customer';

  const [conversations, setConversations] = useState<SupportConversationSummaryDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const { socket, connected } = useSupportSocket(isCustomer && !!accessToken);

  const loadList = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      setConversations(await apiFetch<SupportConversationSummaryDto[]>('/api/support/conversations?pageSize=50', { headers: authHeaders(accessToken) }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : clientError('supportChat.loadFailed'));
    }
  }, [accessToken]);

  useEffect(() => {
    if (isCustomer) void loadList();
  }, [isCustomer, loadList]);

  // Re-sync the list after every (re)connect — events may have been missed while offline.
  useEffect(() => {
    if (connected) void loadList();
  }, [connected, loadList]);

  useEffect(() => {
    if (!socket) return;
    const onUpdated = (row: SupportConversationSummaryDto) => setConversations((prev) => (prev ? upsert(prev, row) : prev));
    const onUnread = (e: SupportCustomerUnreadEvent) => publishSupportUnread(e.total);
    socket.on('conversation-updated', onUpdated);
    socket.on('unread', onUnread);
    return () => {
      socket.off('conversation-updated', onUpdated);
      socket.off('unread', onUnread);
    };
  }, [socket]);

  const onSummary = useCallback((row: SupportConversationSummaryDto) => {
    setConversations((prev) => {
      if (!prev) return prev;
      const existing = prev.find((c) => c.id === row.id);
      if (existing && existing.unreadCount === row.unreadCount && existing.lastMessageAt === row.lastMessageAt && existing.isResolved === row.isResolved) return prev;
      return upsert(prev, {
        id: row.id,
        context: row.context,
        isResolved: row.isResolved,
        lastMessagePreview: row.lastMessagePreview,
        lastMessageFromMe: row.lastMessageFromMe,
        lastMessageAt: row.lastMessageAt,
        unreadCount: row.unreadCount,
      });
    });
  }, []);

  if (!isReady) return null;

  if (!user || !isCustomer || !accessToken) {
    const next = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return (
      <div className="mx-auto max-w-md rounded-card border border-gray-200 bg-white p-6 text-center">
        <span aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-navy text-brand-gold">
          <HeadsetIcon />
        </span>
        <h1 className="text-lg font-semibold">{t('supportChat.title')}</h1>
        {user && !isCustomer ? (
          <p className="mt-2 text-sm text-gray-600">{t('supportChat.notAvailable')}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-600">{t('supportChat.signInPrompt')}</p>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="mt-4 inline-block rounded-field bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
              {t('supportChat.signIn')}
            </Link>
          </>
        )}
      </div>
    );
  }

  const rawContext = searchParams.get('context');
  const contextType: SupportContextType = CONTEXT_TYPES.includes(rawContext as SupportContextType) ? (rawContext as SupportContextType) : 'general';
  const contextId = contextType === 'general' ? null : searchParams.get('id');
  const contextDisplay = searchParams.get('label');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('supportChat.title')}</h1>
        <Link href="/account/support/new" className="rounded-field bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:bg-brand-navyLight">
          {t('supportChat.newConversation')}
        </Link>
      </div>

      <div className="grid overflow-hidden rounded-card border border-gray-200 bg-white md:h-[calc(100dvh-14rem)] md:min-h-[30rem] md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside aria-label={t('supportChat.conversations')} className={`${mode === 'list' ? 'flex' : 'hidden md:flex'} min-h-0 flex-col border-gray-200 md:border-e`}>
          <h2 className="border-b border-gray-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('supportChat.conversations')}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {listError && (
              <div className="p-3">
                <ErrorBanner error={listError} onRetry={() => void loadList()} />
              </div>
            )}
            <SupportConversationList conversations={listError ? [] : conversations} selectedId={selectedId ?? null} />
          </div>
        </aside>

        <div className={`${mode === 'list' ? 'hidden md:flex' : 'flex'} min-h-0 flex-col`}>
          {mode === 'thread' && selectedId ? (
            <SupportThread key={selectedId} conversationId={selectedId} accessToken={accessToken} socket={socket} connected={connected} onSummary={onSummary} />
          ) : mode === 'new' ? (
            <SupportNewConversation
              key={`${contextType}:${contextId ?? ''}`}
              accessToken={accessToken}
              contextType={contextId ? contextType : 'general'}
              contextId={contextId}
              contextDisplay={contextDisplay}
              onStarted={() => void loadList()}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-gray-500">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-navy text-brand-gold">
                <HeadsetIcon />
              </span>
              <p className="max-w-xs">{t('supportChat.subtitle')}</p>
              <Link href="/account/support/new" className="font-medium text-brand-navy underline">
                {t('supportChat.startConversation')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
