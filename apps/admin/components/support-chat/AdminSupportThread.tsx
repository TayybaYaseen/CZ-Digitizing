'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  AdminSupportConversationDto,
  AdminSupportConversationSummaryDto,
  AdminSupportMessageDto,
  AdminSupportReadResult,
  ApiError,
  SupportConversationStatus,
  SupportReadEvent,
  SupportSocketAck,
  SupportTypingEvent,
} from '@czd/shared-types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { authHeaders, contextLabel, linkify, newClientMessageId, publishStaffUnread, STATUS_LABEL, STATUS_TONE } from '@/lib/support-chat';
import { CustomerInfoPanel } from './CustomerInfoPanel';

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
  canReply: boolean;
  backHref: string;
  onSummary: (summary: AdminSupportConversationSummaryDto) => void;
}

const PAGE = 30;
const MAX_LENGTH = 4000;

const byId = (a: { id: string }, b: { id: string }) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
function merge(current: AdminSupportMessageDto[], incoming: AdminSupportMessageDto[]) {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort(byId);
}

function errorOf(err: unknown, fallback: string): ApiError {
  return err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: fallback, traceId: '' };
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §7/§8.4/§11/§15/§16 — one conversation in the
// Admin inbox: paged history (incl. Admin-only status lines), live updates, reply, status control, and
// the customer/context panel (a drawer below xl widths).
export function AdminSupportThread({ conversationId, accessToken, socket, connected, canReply, backHref, onSummary }: Props) {
  const [detail, setDetail] = useState<AdminSupportConversationDto | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessageDto[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [alreadyOpenId, setAlreadyOpenId] = useState<string | null>(null);
  const [customerTyping, setCustomerTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [joined, setJoined] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  const [visible, setVisible] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<AdminSupportMessageDto[]>([]);
  const atBottomRef = useRef(true);
  const lastMarkedRef = useRef<bigint>(0n);
  const prependAnchor = useRef<{ height: number; top: number } | null>(null);
  const prevLastId = useRef<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const typingState = useRef<{ active: boolean; last: number; idle?: ReturnType<typeof setTimeout> }>({ active: false, last: 0 });
  messagesRef.current = messages;
  const headers = authHeaders(accessToken);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [conv, page] = await Promise.all([
        apiFetch<AdminSupportConversationDto>(`/api/admin/support/conversations/${conversationId}`, { headers: authHeaders(accessToken) }),
        apiFetchWithMeta<AdminSupportMessageDto[]>(`/api/admin/support/conversations/${conversationId}/messages?limit=${PAGE}`, { headers: authHeaders(accessToken) }),
      ]);
      setDetail(conv);
      setMessages(page.data);
      setHasMore(Boolean((page.meta as { hasMore?: boolean } | undefined)?.hasMore));
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'RESOURCE_NOT_FOUND') setNotFound(true);
      else setError(errorOf(err, 'Failed to load the conversation.'));
    }
  }, [conversationId, accessToken]);

  useEffect(() => {
    setDetail(null);
    setMessages([]);
    setPending([]);
    setNotFound(false);
    setAlreadyOpenId(null);
    lastMarkedRef.current = 0n;
    prevLastId.current = null;
    void load();
  }, [load]);

  const refreshDetail = useCallback(async () => {
    try {
      setDetail(await apiFetch<AdminSupportConversationDto>(`/api/admin/support/conversations/${conversationId}`, { headers: authHeaders(accessToken) }));
    } catch {
      // keep what we have
    }
  }, [conversationId, accessToken]);

  const gapFill = useCallback(async () => {
    const last = messagesRef.current.at(-1)?.id;
    if (!last) return;
    try {
      let after = last;
      for (let i = 0; i < 10; i += 1) {
        const page = await apiFetchWithMeta<AdminSupportMessageDto[]>(`/api/admin/support/conversations/${conversationId}/messages?after=${after}&limit=100`, {
          headers: authHeaders(accessToken),
        });
        if (page.data.length) setMessages((prev) => merge(prev, page.data));
        const newest = page.data.at(-1)?.id;
        if (!(page.meta as { hasMore?: boolean } | undefined)?.hasMore || !newest) break;
        after = newest;
      }
      await refreshDetail();
    } catch {
      // retried on the next reconnect / focus
    }
  }, [conversationId, accessToken, refreshDetail]);

  // ---- socket ----
  useEffect(() => {
    if (!socket || !connected) {
      setJoined(false);
      return;
    }
    let cancelled = false;
    setEverConnected(true);
    socket.emit('join', { conversationId }, (ack: SupportSocketAck) => {
      if (!cancelled) setJoined(ack.ok);
    });
    void gapFill();
    return () => {
      cancelled = true;
      socket.emit('leave', { conversationId });
    };
  }, [socket, connected, conversationId, gapFill]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: AdminSupportMessageDto) => {
      if (m.conversationId !== conversationId) return;
      setMessages((prev) => merge(prev, [m]));
      setPending((prev) => prev.filter((p) => p.clientMessageId !== m.clientMessageId));
      if (m.senderType === 'customer') setCustomerTyping(false);
    };
    const onRead = (e: SupportReadEvent) => {
      if (e.conversationId !== conversationId || e.side !== 'customer') return;
      setDetail((prev) => (prev ? { ...prev, customerLastReadMessageId: e.lastReadMessageId } : prev));
    };
    const onTyping = (e: SupportTypingEvent) => {
      if (e.conversationId !== conversationId || e.side !== 'customer') return;
      setCustomerTyping(e.isTyping);
      clearTimeout(typingTimer.current);
      if (e.isTyping) typingTimer.current = setTimeout(() => setCustomerTyping(false), 5000);
    };
    const onUpdated = (s: AdminSupportConversationSummaryDto) => {
      if (s.id !== conversationId) return;
      setDetail((prev) => (prev ? { ...prev, ...s } : prev));
      if (s.status !== detail?.status) void refreshDetail();
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
  }, [socket, conversationId, detail?.status, refreshDetail]);

  useEffect(() => {
    const onVisibility = () => {
      const v = document.visibilityState === 'visible';
      setVisible(v);
      if (v) void gapFill();
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

  // ---- read (team-level, §15) ----
  useEffect(() => {
    const newest = messages.at(-1);
    if (!newest || !visible || !atBottom) return;
    const newestId = BigInt(newest.id);
    if (newestId <= lastMarkedRef.current) return;
    if ((detail?.unreadCount ?? 0) === 0 && !messages.some((m) => m.senderType === 'customer' && BigInt(m.id) > lastMarkedRef.current)) {
      lastMarkedRef.current = newestId;
      return;
    }
    const timer = setTimeout(() => {
      lastMarkedRef.current = newestId;
      apiFetch<AdminSupportReadResult>(`/api/admin/support/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ upToMessageId: newest.id }),
      })
        .then((res) => {
          publishStaffUnread(res.totalUnreadConversations);
          setDetail((prev) => (prev ? { ...prev, unreadCount: res.unreadCount } : prev));
        })
        .catch(() => {
          lastMarkedRef.current = 0n;
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [messages, visible, atBottom, detail?.unreadCount, conversationId, accessToken]);

  useEffect(() => {
    if (detail) onSummary(detail);
  }, [detail, onSummary]);

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
      el.scrollTop = el.scrollHeight - prependAnchor.current.height + prependAnchor.current.top;
      prependAnchor.current = null;
      return;
    }
    const lastId = messages.at(-1)?.id ?? null;
    const firstLoad = prevLastId.current === null;
    const changed = lastId !== prevLastId.current;
    prevLastId.current = lastId;
    if (!changed && pending.length === 0) return;
    if (firstLoad || atBottomRef.current || messages.at(-1)?.senderType !== 'customer' || pending.some((p) => p.status === 'sending')) scrollToBottom();
    else setShowJump(true);
  }, [messages, pending, scrollToBottom]);

  async function loadOlder() {
    const el = scrollRef.current;
    const oldest = messages[0];
    if (!el || !oldest || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const page = await apiFetchWithMeta<AdminSupportMessageDto[]>(`/api/admin/support/conversations/${conversationId}/messages?before=${oldest.id}&limit=${PAGE}`, { headers });
      prependAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((prev) => merge(prev, page.data));
      setHasMore(Boolean((page.meta as { hasMore?: boolean } | undefined)?.hasMore));
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

  // ---- reply / typing / status ----
  function emitTyping(text: string) {
    if (!socket || !joined) return;
    const s = typingState.current;
    clearTimeout(s.idle);
    if (!text.trim()) {
      if (s.active) socket.emit('typing', { conversationId, isTyping: false });
      s.active = false;
      return;
    }
    if (!s.active || Date.now() - s.last > 3000) {
      socket.emit('typing', { conversationId, isTyping: true });
      s.active = true;
      s.last = Date.now();
    }
    s.idle = setTimeout(() => {
      s.active = false;
      socket.emit('typing', { conversationId, isTyping: false });
    }, 4000);
  }

  async function send(body: string, clientMessageId = newClientMessageId()) {
    setError(null);
    setPending((prev) => [...prev.filter((p) => p.clientMessageId !== clientMessageId), { clientMessageId, body, status: 'sending' }]);
    try {
      const message = await apiFetch<AdminSupportMessageDto>(`/api/admin/support/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientMessageId, body }),
      });
      setMessages((prev) => merge(prev, [message]));
      setPending((prev) => prev.filter((p) => p.clientMessageId !== clientMessageId));
      void refreshDetail();
    } catch (err) {
      setPending((prev) => prev.map((p) => (p.clientMessageId === clientMessageId ? { ...p, status: 'failed' } : p)));
      if (err instanceof ApiClientError && err.error.code !== 'INTERNAL_ERROR') setError(err.error);
    }
  }

  function submit() {
    const body = draft.trim();
    if (!body || draft.length > MAX_LENGTH) return;
    setDraft('');
    clearTimeout(typingState.current.idle);
    if (typingState.current.active) socket?.emit('typing', { conversationId, isTyping: false });
    typingState.current.active = false;
    void send(body);
  }

  async function changeStatus(status: SupportConversationStatus) {
    if (!detail || status === detail.status) return;
    setStatusBusy(true);
    setError(null);
    setAlreadyOpenId(null);
    try {
      const updated = await apiFetch<AdminSupportConversationDto>(`/api/admin/support/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      setDetail(updated);
      void gapFill();
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'CONVERSATION_ALREADY_OPEN') setAlreadyOpenId(err.error.errors?.[0]?.message || null);
      setError(errorOf(err, 'Failed to change the status.'));
    } finally {
      setStatusBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-gray-600">
        <p>This conversation doesn’t exist.</p>
        <Link href={backHref} className="font-semibold text-gold-700 underline">
          Back to Live Chat
        </Link>
      </div>
    );
  }

  const lastSupport = [...messages].reverse().find((m) => m.senderType === 'admin');
  const seenId = detail?.customerLastReadMessageId ? BigInt(detail.customerLastReadMessageId) : null;

  return (
    <div className="flex h-full min-h-0">
      <section aria-labelledby="admin-thread-title" className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <Link href={backHref} className="text-sm font-semibold text-gray-600 lg:hidden" aria-label="Back to conversations">
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h2 id="admin-thread-title" className="truncate text-sm font-semibold text-navy-800">
              {detail ? (detail.customer.displayName ?? detail.customer.email) : 'Loading…'}
            </h2>
            {detail && <p className="truncate text-xs text-gray-500">{contextLabel(detail.context)}</p>}
          </div>
          {detail && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="sr-only">Conversation status</span>
              {/* Editors get the dropdown; read-only staff see the status as a badge. */}
              {!canReply && <Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>}
              {canReply && (
                <select
                  value={detail.status}
                  disabled={statusBusy}
                  onChange={(e) => void changeStatus(e.target.value as SupportConversationStatus)}
                  className="rounded-field border border-gray-300 bg-white px-2 py-1.5 text-xs"
                >
                  {(['open', 'pending', 'resolved'] as const).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="rounded-field border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 xl:hidden"
            aria-haspopup="dialog"
          >
            Info
          </button>
        </header>

        {everConnected && !connected && <p className="bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-800">Reconnecting… replies still send.</p>}
        {error && (
          <div className="px-4 pt-3">
            <ErrorBanner error={error} />
            {alreadyOpenId && (
              <Link href={`/support/live-chat/${alreadyOpenId}`} className="mt-1 inline-block text-xs font-semibold text-gold-700 underline">
                Open the active conversation
              </Link>
            )}
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-labelledby="admin-thread-title"
            className="h-full overflow-y-auto overscroll-contain bg-gray-50 px-4 py-4"
          >
            {loadingOlder && <p className="pb-3 text-center text-xs text-gray-500">Loading earlier messages…</p>}
            {!detail && !error && <p className="py-8 text-center text-sm text-gray-500">Loading…</p>}
            <ol className="space-y-2">
              {messages.map((m) => (
                <li key={m.id}>
                  {m.senderType === 'system' ? (
                    <p className="my-2 text-center text-[11px] italic text-gray-500">
                      {m.body}
                      {m.sender?.displayName ? ` · by ${m.sender.displayName}` : ''} · {new Date(m.createdAt).toLocaleString()}
                    </p>
                  ) : (
                    <Bubble
                      message={m}
                      footer={m.id === lastSupport?.id && seenId !== null && seenId >= BigInt(m.id) ? 'Seen' : undefined}
                    />
                  )}
                </li>
              ))}
              {pending.map((p) => (
                <li key={p.clientMessageId} className="flex flex-col items-end">
                  <div className="max-w-[75%] rounded-2xl rounded-ee-md bg-navy-800 px-3.5 py-2 text-sm text-white opacity-80">
                    <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {p.body}
                    </p>
                  </div>
                  <p className="mt-0.5 px-1 text-[11px] text-gray-500">
                    {p.status === 'sending' ? (
                      'Sending…'
                    ) : (
                      <span className="text-red-600">
                        Not sent ·{' '}
                        <button type="button" className="font-semibold underline" onClick={() => void send(p.body, p.clientMessageId)}>
                          Retry
                        </button>
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ol>
            {customerTyping && (
              <p role="status" className="mt-2 text-xs italic text-gray-500">
                Customer is typing…
              </p>
            )}
          </div>
          {showJump && (
            <button type="button" onClick={scrollToBottom} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              New messages ↓
            </button>
          )}
        </div>

        {canReply ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="border-t border-gray-200 bg-white p-3"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="admin-support-reply" className="sr-only">
                Reply
              </label>
              <textarea
                id="admin-support-reply"
                rows={2}
                dir="auto"
                value={draft}
                maxLength={MAX_LENGTH}
                placeholder={detail?.status === 'resolved' ? 'Reply to reopen (it becomes Pending)…' : 'Reply…'}
                onChange={(e) => {
                  setDraft(e.target.value);
                  emitTyping(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                className="max-h-40 min-h-[44px] flex-1 resize-y rounded-field border border-gray-300 px-3 py-2 text-sm focus:border-navy-800 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !detail}
                className="h-11 rounded-field bg-gold-500 px-5 text-sm font-semibold text-navy-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Send
              </button>
            </div>
            {draft.length >= 3500 && <p className="mt-1 text-end text-xs text-gray-500">{MAX_LENGTH - draft.length} characters left</p>}
          </form>
        ) : (
          <p className="border-t border-gray-200 bg-white p-3 text-center text-xs text-gray-500">You have read-only access to Live Chat.</p>
        )}
      </section>

      {detail && (
        <aside aria-label="Customer details" className="hidden w-80 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white xl:block">
          <CustomerInfoPanel detail={detail} />
        </aside>
      )}

      {detail && infoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer details"
          className="fixed inset-0 z-50 flex justify-end bg-black/30 xl:hidden"
          onClick={() => setInfoOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setInfoOpen(false)}
        >
          <div className="h-full w-80 max-w-[90vw] overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2">
              <button type="button" autoFocus onClick={() => setInfoOpen(false)} className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">
                Close
              </button>
            </div>
            <CustomerInfoPanel detail={detail} />
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ message, footer }: { message: AdminSupportMessageDto; footer?: string }) {
  const support = message.senderType === 'admin';
  return (
    <div className={`flex flex-col ${support ? 'items-end' : 'items-start'}`}>
      {support && <p className="mb-0.5 px-1 text-[11px] font-medium text-gray-500">{message.sender?.displayName ?? 'Former team member'}</p>}
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          support ? 'rounded-ee-md bg-navy-800 text-white' : 'rounded-es-md border border-gray-200 bg-white text-navy-800'
        }`}
      >
        <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {linkify(message.body).map((part, i) =>
            part.href ? (
              <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc" className={`underline ${support ? 'text-gold-300' : 'text-navy-800'}`}>
                {part.text}
              </a>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
      </div>
      <p className="mt-0.5 px-1 text-[11px] text-gray-500">
        <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
        {footer ? ` · ${footer}` : ''}
      </p>
    </div>
  );
}
