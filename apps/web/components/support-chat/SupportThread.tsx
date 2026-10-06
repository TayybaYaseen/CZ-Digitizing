'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  ApiError,
  SupportConversationDto,
  SupportConversationSummaryDto,
  SupportMessageDto,
  SupportReadEvent,
  SupportReadResult,
  SupportSocketAck,
  SupportTypingEvent,
} from '@czd/shared-types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { BackArrow } from '@/components/DirectionalArrow';
import { clientError } from '@/i18n/api-errors';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useLocale } from '@/lib/locale-context';
import { authHeaders, contextLabel, newClientMessageId, publishSupportUnread } from '@/lib/support-chat';
import { SupportComposer } from './SupportComposer';
import { SupportMessageBubble } from './SupportMessageBubble';
import { useVisualViewportHeight } from './useVisualViewportHeight';

interface PendingMessage {
  clientMessageId: string;
  body: string;
  status: 'sending' | 'failed';
}

interface Props {
  conversationId: string;
  accessToken: string;
  socket: Socket | null;
  connected: boolean;
  onSummary: (summary: SupportConversationSummaryDto) => void;
}

const PAGE = 30;
const TYPING_TIMEOUT_MS = 5000;

const CONTEXT_HREF: Record<string, string> = {
  order: '/account/orders',
  custom_request: '/account/custom-requests',
  quote: '/account/quotes',
  file_format_request: '/account/purchased-designs',
};

const byId = (a: { id: string }, b: { id: string }) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);

function mergeMessages(current: SupportMessageDto[], incoming: SupportMessageDto[]): SupportMessageDto[] {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort(byId);
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2, §11.6–§11.8, §15, §21, §23, §26, §27.
export function SupportThread({ conversationId, accessToken, socket, connected, onSummary }: Props) {
  const router = useRouter();
  const { t, formatDate, errorMessage } = useLocale();
  const vvh = useVisualViewportHeight();

  const [conversation, setConversation] = useState<SupportConversationDto | null>(null);
  const [messages, setMessages] = useState<SupportMessageDto[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [supportTyping, setSupportTyping] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [visible, setVisible] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<SupportMessageDto[]>([]);
  const atBottomRef = useRef(true);
  const lastMarkedRef = useRef<bigint>(0n);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const prependAnchor = useRef<{ height: number; top: number } | null>(null);
  const prevLastId = useRef<string | null>(null);

  messagesRef.current = messages;
  const headers = authHeaders(accessToken);

  // ---- initial load ----
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [conv, page] = await Promise.all([
        apiFetch<SupportConversationDto>(`/api/support/conversations/${conversationId}`, { headers: authHeaders(accessToken) }),
        apiFetchWithMeta<SupportMessageDto[]>(`/api/support/conversations/${conversationId}/messages?limit=${PAGE}`, { headers: authHeaders(accessToken) }),
      ]);
      setConversation(conv);
      setMessages(page.data);
      setHasMore(Boolean((page.meta as { hasMore?: boolean } | undefined)?.hasMore));
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'RESOURCE_NOT_FOUND') setNotFound(true);
      else setLoadError(err instanceof ApiClientError ? err.error : clientError('supportChat.loadFailed'));
    }
  }, [conversationId, accessToken]);

  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setPending([]);
    setNotFound(false);
    setJoined(false);
    lastMarkedRef.current = 0n;
    prevLastId.current = null;
    void load();
  }, [load]);

  // ---- gap-fill after reconnect / tab return (§11.7) ----
  const gapFill = useCallback(async () => {
    const last = messagesRef.current.at(-1)?.id;
    if (!last) return;
    try {
      let after = last;
      for (let i = 0; i < 10; i += 1) {
        const page = await apiFetchWithMeta<SupportMessageDto[]>(`/api/support/conversations/${conversationId}/messages?after=${after}&limit=100`, {
          headers: authHeaders(accessToken),
        });
        if (page.data.length) setMessages((prev) => mergeMessages(prev, page.data));
        const more = Boolean((page.meta as { hasMore?: boolean } | undefined)?.hasMore);
        const newest = page.data.at(-1)?.id;
        if (!more || !newest) break;
        after = newest;
      }
      const conv = await apiFetch<SupportConversationDto>(`/api/support/conversations/${conversationId}`, { headers: authHeaders(accessToken) });
      setConversation(conv);
    } catch {
      // the next reconnect/visibility change retries
    }
  }, [conversationId, accessToken]);

  // ---- socket: join, live events (§11.5) ----
  useEffect(() => {
    if (!socket || !connected) {
      setJoined(false);
      return;
    }
    let cancelled = false;
    setEverConnected(true);
    socket.emit('join', { conversationId }, (ack: SupportSocketAck) => {
      if (cancelled) return;
      setJoined(ack.ok);
    });
    void gapFill();
    return () => {
      cancelled = true;
      socket.emit('leave', { conversationId });
    };
  }, [socket, connected, conversationId, gapFill]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: SupportMessageDto) => {
      if (m.conversationId !== conversationId) return;
      setMessages((prev) => mergeMessages(prev, [m]));
      setPending((prev) => prev.filter((p) => p.clientMessageId !== m.clientMessageId));
      if (m.senderType === 'admin') setSupportTyping(false);
    };
    const onRead = (e: SupportReadEvent) => {
      if (e.conversationId !== conversationId || e.side !== 'support') return;
      setConversation((prev) => (prev ? { ...prev, supportLastReadMessageId: e.lastReadMessageId } : prev));
    };
    const onTyping = (e: SupportTypingEvent) => {
      if (e.conversationId !== conversationId || e.side !== 'support') return;
      setSupportTyping(e.isTyping);
      clearTimeout(typingTimer.current);
      // Never leave a stuck indicator if the "stopped" event is lost (§11.8).
      if (e.isTyping) typingTimer.current = setTimeout(() => setSupportTyping(false), TYPING_TIMEOUT_MS);
    };
    const onUpdated = (s: SupportConversationSummaryDto) => {
      if (s.id !== conversationId) return;
      setConversation((prev) => (prev ? { ...prev, ...s, unreadCount: prev.unreadCount } : prev));
    };
    socket.on('message', onMessage);
    socket.on('read', onRead);
    socket.on('typing', onTyping);
    socket.on('conversation-updated', onUpdated);
    return () => {
      socket.off('message', onMessage);
      socket.off('read', onRead);
      socket.off('typing', onTyping);
      socket.off('conversation-updated', onUpdated);
      clearTimeout(typingTimer.current);
    };
  }, [socket, conversationId]);

  // ---- visibility → "viewing" (suppresses notifications, §17.3) and gap-fill on return ----
  useEffect(() => {
    const onVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      setVisible(isVisible);
      if (isVisible) void gapFill();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [gapFill]);

  useEffect(() => {
    if (!socket || !joined) return;
    socket.emit('viewing', { conversationId, visible });
    return () => {
      socket.emit('viewing', { conversationId, visible: false });
    };
  }, [socket, joined, visible, conversationId]);

  // ---- read receipts (§15): thread open, tab visible, newest message in view ----
  useEffect(() => {
    const newest = messages.at(-1);
    if (!newest || !visible || !atBottom) return;
    const newestId = BigInt(newest.id);
    if (newestId <= lastMarkedRef.current) return;
    const hasUnreadFromSupport = messages.some((m) => m.senderType === 'admin' && BigInt(m.id) > lastMarkedRef.current);
    if (!hasUnreadFromSupport && (conversation?.unreadCount ?? 0) === 0) {
      lastMarkedRef.current = newestId;
      return;
    }
    const timer = setTimeout(() => {
      lastMarkedRef.current = newestId;
      apiFetch<SupportReadResult>(`/api/support/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ upToMessageId: newest.id }),
      })
        .then((res) => {
          publishSupportUnread(res.totalUnread);
          setConversation((prev) => (prev ? { ...prev, unreadCount: res.unreadCount } : prev));
        })
        .catch(() => {
          lastMarkedRef.current = 0n;
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [messages, visible, atBottom, conversation?.unreadCount, conversationId, accessToken]);

  // ---- scrolling ----
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setShowJump(false);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prependAnchor.current) {
      // Older page prepended: keep the same message under the reader's eyes (§21).
      el.scrollTop = el.scrollHeight - prependAnchor.current.height + prependAnchor.current.top;
      prependAnchor.current = null;
      return;
    }
    const lastId = messages.at(-1)?.id ?? null;
    const isNewTail = lastId !== prevLastId.current;
    const firstLoad = prevLastId.current === null;
    prevLastId.current = lastId;
    if (!isNewTail && pending.length === 0) return;
    const mine = messages.at(-1)?.senderType === 'customer';
    if (firstLoad || atBottomRef.current || mine || pending.some((p) => p.status === 'sending')) scrollToBottom();
    else setShowJump(true);
  }, [messages, pending, scrollToBottom]);

  async function loadOlder() {
    const el = scrollRef.current;
    const oldest = messages[0];
    if (!el || !oldest || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const page = await apiFetchWithMeta<SupportMessageDto[]>(`/api/support/conversations/${conversationId}/messages?before=${oldest.id}&limit=${PAGE}`, { headers });
      prependAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((prev) => mergeMessages(prev, page.data));
      setHasMore(Boolean((page.meta as { hasMore?: boolean } | undefined)?.hasMore));
    } catch {
      // stays at the top; scrolling again retries
    } finally {
      setLoadingOlder(false);
    }
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
    if (bottom) setShowJump(false);
    if (el.scrollTop < 80) void loadOlder();
  }

  // ---- sending (§11.6, §30) ----
  async function send(body: string, clientMessageId = newClientMessageId()) {
    setSendError(null);
    setPending((prev) => [...prev.filter((p) => p.clientMessageId !== clientMessageId), { clientMessageId, body, status: 'sending' }]);
    try {
      const message = await apiFetch<SupportMessageDto>(`/api/support/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientMessageId, body }),
      });
      setMessages((prev) => mergeMessages(prev, [message]));
      setPending((prev) => prev.filter((p) => p.clientMessageId !== clientMessageId));
      setConversation((prev) => (prev ? { ...prev, isResolved: false, lastMessageFromMe: true, lastMessagePreview: body, lastMessageAt: message.createdAt } : prev));
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'CONVERSATION_ALREADY_OPEN') {
        const existing = err.error.errors?.[0]?.message;
        setPending((prev) => prev.filter((p) => p.clientMessageId !== clientMessageId));
        setSendError(t('supportChat.alreadyOpen'));
        if (existing) router.push(`/account/support/${existing}`);
        return;
      }
      if (err instanceof ApiClientError && ['VALIDATION_ERROR', 'RATE_LIMITED', 'FORBIDDEN'].includes(err.error.code)) {
        setSendError(err.error.code === 'VALIDATION_ERROR' ? (err.error.errors?.[0]?.message ?? errorMessage(err.error)) : errorMessage(err.error));
      }
      setPending((prev) => prev.map((p) => (p.clientMessageId === clientMessageId ? { ...p, status: 'failed' } : p)));
    }
  }

  function emitTyping(isTyping: boolean) {
    if (socket && joined) socket.emit('typing', { conversationId, isTyping });
  }

  // Keep the list's row in sync with what this thread knows.
  useEffect(() => {
    if (conversation) onSummary(conversation);
  }, [conversation, onSummary]);

  // ---- render ----
  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-gray-600">
        <p>{t('supportChat.notAvailable')}</p>
        <Link href="/account/support" className="font-medium text-brand-navy underline">
          {t('supportChat.back')}
        </Link>
      </div>
    );
  }

  const lastOwn = [...messages].reverse().find((m) => m.senderType === 'customer');
  const seenId = conversation?.supportLastReadMessageId ? BigInt(conversation.supportLastReadMessageId) : null;

  return (
    <section
      aria-labelledby="support-thread-title"
      className="fixed inset-x-0 top-0 z-[60] flex h-[var(--support-vvh,100dvh)] flex-col bg-brand-lightGray md:static md:z-auto md:h-full"
      style={{ ['--support-vvh' as string]: vvh ? `${vvh}px` : undefined }}
    >
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2.5">
        <Link
          href="/account/support"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-navy hover:bg-gray-100 md:hidden"
          aria-label={t('supportChat.back')}
        >
          <BackArrow />
        </Link>
        <span aria-hidden="true" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-navy text-brand-gold">
          <HeadsetIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="support-thread-title" className="truncate text-sm font-semibold text-brand-navy">
            {t('supportChat.teamName')}
          </h2>
          <p className="truncate text-xs text-gray-500">{t('supportChat.subtitle')}</p>
        </div>
        {conversation && conversation.context.type !== 'general' && (
          <Link
            href={CONTEXT_HREF[conversation.context.type] ?? '/account'}
            className="hidden max-w-[40%] flex-shrink-0 truncate rounded-full border border-brand-gold/60 bg-brand-gold/10 px-2.5 py-1 text-xs font-medium text-brand-navy sm:inline-block"
          >
            <bdi>{contextLabel(t, conversation.context)}</bdi>
          </Link>
        )}
      </header>

      {conversation && conversation.context.type !== 'general' && (
        <div className="border-b border-gray-200 bg-white px-3 py-1.5 text-xs sm:hidden">
          <Link href={CONTEXT_HREF[conversation.context.type] ?? '/account'} className="font-medium text-brand-navy underline">
            <bdi>{contextLabel(t, conversation.context)}</bdi>
          </Link>
        </div>
      )}

      {everConnected && !connected && (
        <p role="status" className="bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-800">
          {t('supportChat.reconnecting')}
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-labelledby="support-thread-title"
        >
          {loadError && <ErrorBanner error={loadError} onRetry={() => void load()} />}
          {!conversation && !loadError && <p className="py-8 text-center text-sm text-gray-500">{t('common.loading')}</p>}
          {loadingOlder && <p className="pb-3 text-center text-xs text-gray-500">{t('supportChat.loadingOlder')}</p>}

          {conversation && messages.length === 0 && pending.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">{t('supportChat.howCanWeHelp')}</p>
          )}

          <ol className="space-y-2">
            {messages.map((m, i) => {
              const day = formatDate(m.createdAt, { weekday: 'long', day: 'numeric', month: 'long' });
              const prevDay = i > 0 ? formatDate(messages[i - 1]!.createdAt, { weekday: 'long', day: 'numeric', month: 'long' }) : null;
              return (
                <li key={m.id}>
                  {day !== prevDay && (
                    <p className="my-3 text-center text-xs font-medium text-gray-500" aria-hidden="true">
                      {day}
                    </p>
                  )}
                  <SupportMessageBubble
                    own={m.senderType === 'customer'}
                    body={m.body}
                    createdAt={m.createdAt}
                    footer={m.id === lastOwn?.id && seenId !== null && seenId >= BigInt(m.id) ? t('supportChat.seen') : undefined}
                  />
                </li>
              );
            })}
            {pending.map((p) => (
              <li key={p.clientMessageId}>
                <SupportMessageBubble
                  own
                  body={p.body}
                  createdAt={null}
                  footer={
                    p.status === 'sending' ? (
                      t('supportChat.sending')
                    ) : (
                      <span className="text-red-600">
                        {t('supportChat.notSent')} ·{' '}
                        <button type="button" onClick={() => void send(p.body, p.clientMessageId)} className="font-semibold underline">
                          {t('supportChat.retry')}
                        </button>
                      </span>
                    )
                  }
                />
              </li>
            ))}
          </ol>

          {supportTyping && (
            <p className="mt-2 text-xs italic text-gray-500" role="status">
              {t('supportChat.typing')}
            </p>
          )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 start-1/2 -translate-x-1/2 rounded-full bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white shadow-lg rtl:translate-x-1/2"
          >
            {t('supportChat.jumpToLatest')}
          </button>
        )}
      </div>

      {conversation?.isResolved && (
        <p className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs text-gray-600">{t('supportChat.resolvedBanner')}</p>
      )}

      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className="bg-white">
        <SupportComposer onSend={(body) => void send(body)} onTyping={emitTyping} autoFocus error={sendError} disabled={!conversation} />
      </div>
    </section>
  );
}

export function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" strokeLinecap="round" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" />
      <path d="M19 19c0 1.5-2 2.5-5 2.5" strokeLinecap="round" />
    </svg>
  );
}
