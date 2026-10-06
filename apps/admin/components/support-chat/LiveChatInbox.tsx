'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminSupportConversationSummaryDto, ApiError, SupportContextType, SupportConversationStatus, SupportStaffUnreadEvent } from '@czd/shared-types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { ApiClientError, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { authHeaders, contextLabel, publishStaffUnread, STATUS_LABEL, STATUS_TONE, supportAccess, useSupportSocket } from '@/lib/support-chat';
import { AdminSupportThread } from './AdminSupportThread';

type StatusTab = SupportConversationStatus | 'all';
const TABS: StatusTab[] = ['open', 'pending', 'resolved', 'all'];
const CONTEXTS: (SupportContextType | '')[] = ['', 'general', 'order', 'custom_request', 'quote', 'file_format_request'];
const CONTEXT_OPTION: Record<string, string> = {
  '': 'Any context',
  general: 'General',
  order: 'Order',
  custom_request: 'Custom request',
  quote: 'Quote',
  file_format_request: 'Format request',
};
const PAGE_SIZE = 25;

function sortRows(rows: AdminSupportConversationSummaryDto[]) {
  return rows.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : a.lastMessageAt > b.lastMessageAt ? -1 : 0));
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §7/§8.4/§22/§24 — Admin → Customer Support →
// Live Chat. Filters live in the URL so a refresh or a shared link reproduces the view.
export function LiveChatInbox({ selectedId }: { selectedId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, accessToken, isReady } = useAuth();
  const { canRead, canReply } = supportAccess(accessToken);

  const status = (TABS.includes(searchParams.get('status') as StatusTab) ? searchParams.get('status') : 'open') as StatusTab;
  const unreadOnly = searchParams.get('unread') === 'true';
  const contextType = (CONTEXTS.includes(searchParams.get('context') as SupportContextType) ? searchParams.get('context') : '') as SupportContextType | '';
  const q = searchParams.get('q') ?? '';

  const [rows, setRows] = useState<AdminSupportConversationSummaryDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<ApiError | null>(null);
  const [search, setSearch] = useState(q);
  const searchRef = useRef<HTMLInputElement>(null);
  const { socket, connected } = useSupportSocket(Boolean(user && accessToken && canRead));

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
    },
    [router, pathname, searchParams],
  );

  // Debounced search → URL.
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => setParams({ q: search.trim() || null }), 300);
    return () => clearTimeout(timer);
  }, [search, q, setParams]);

  // "/" focuses search (§24).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && target && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const query = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (status !== 'all') params.set('status', status);
      if (unreadOnly) params.set('unread', 'true');
      if (contextType) params.set('contextType', contextType);
      if (q) params.set('q', q);
      return `/api/admin/support/conversations?${params.toString()}`;
    },
    [status, unreadOnly, contextType, q],
  );

  const load = useCallback(async () => {
    if (!accessToken || !canRead) return;
    setError(null);
    try {
      const res = await apiFetchWithMeta<AdminSupportConversationSummaryDto[]>(query(1), { headers: authHeaders(accessToken) });
      setRows(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      setPage(1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load conversations.', traceId: '' });
    }
  }, [accessToken, canRead, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  async function loadMore() {
    if (!accessToken) return;
    try {
      const res = await apiFetchWithMeta<AdminSupportConversationSummaryDto[]>(query(page + 1), { headers: authHeaders(accessToken) });
      setRows((prev) => sortRows([...(prev ?? []).filter((r) => !res.data.some((n) => n.id === r.id)), ...res.data]));
      setPage(page + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load more.', traceId: '' });
    }
  }

  const matchesFilters = useCallback(
    (row: AdminSupportConversationSummaryDto) =>
      (status === 'all' || row.status === status) && (!unreadOnly || row.unreadCount > 0) && (!contextType || row.context.type === contextType),
    [status, unreadOnly, contextType],
  );

  const upsert = useCallback(
    (row: AdminSupportConversationSummaryDto) => {
      setRows((prev) => {
        if (!prev) return prev;
        const without = prev.filter((r) => r.id !== row.id);
        // With a text search active, only update rows already shown (the server decides matches).
        if (q && without.length === prev.length) return prev;
        return matchesFilters(row) || row.id === selectedId ? sortRows([row, ...without]) : without;
      });
    },
    [matchesFilters, q, selectedId],
  );

  useEffect(() => {
    if (!socket) return;
    const onUpdated = (row: AdminSupportConversationSummaryDto) => upsert(row);
    const onUnread = (e: SupportStaffUnreadEvent) => publishStaffUnread(e.conversations);
    socket.on('conversation-updated', onUpdated);
    socket.on('unread', onUnread);
    return () => {
      socket.off('conversation-updated', onUpdated);
      socket.off('unread', onUnread);
    };
  }, [socket, upsert]);

  const onSummary = useCallback(
    (row: AdminSupportConversationSummaryDto) => {
      setRows((prev) => {
        if (!prev) return prev;
        const existing = prev.find((r) => r.id === row.id);
        if (!existing) return prev;
        if (existing.unreadCount === row.unreadCount && existing.status === row.status && existing.lastMessageAt === row.lastMessageAt) return prev;
        return sortRows(prev.map((r) => (r.id === row.id ? { ...r, unreadCount: row.unreadCount, status: row.status, lastMessageAt: row.lastMessageAt, lastMessagePreview: row.lastMessagePreview, lastMessageSenderType: row.lastMessageSenderType } : r)));
      });
    },
    [],
  );

  if (!isReady || !user) return null;
  if (!canRead) {
    return <ErrorBanner error={{ code: 'FORBIDDEN', message: 'You do not have access to Live Chat. Ask an admin for the "support_chat" permission.', traceId: '' }} />;
  }

  const qs = searchParams.toString();
  const hrefFor = (id: string) => `/support/live-chat/${id}${qs ? `?${qs}` : ''}`;
  const backHref = `/support/live-chat${qs ? `?${qs}` : ''}`;

  return (
    <div className="-m-6 flex h-[calc(100vh-57px)] min-h-0 overflow-hidden bg-white">
      <aside aria-label="Conversations" className={`${selectedId ? 'hidden lg:flex' : 'flex'} w-full flex-shrink-0 flex-col border-r border-gray-200 lg:w-[360px]`}>
        <div className="space-y-2 border-b border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-navy-800">Live Chat</h1>
            <span className="text-xs text-gray-500">{total} conversation{total === 1 ? '' : 's'}</span>
          </div>
          <label className="block">
            <span className="sr-only">Search conversations</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, #id, order, reference…  ( / )"
              className="w-full rounded-field border border-gray-300 px-3 py-2 text-sm focus:border-navy-800 focus:outline-none"
            />
          </label>
          <div role="tablist" aria-label="Status" className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={status === tab}
                onClick={() => setParams({ status: tab === 'open' ? null : tab })}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${status === tab ? 'bg-navy-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {tab === 'all' ? 'All' : STATUS_LABEL[tab]}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-700">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setParams({ unread: e.target.checked ? 'true' : null })} />
              Unread only
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-700">
              <span className="sr-only">Context</span>
              <select value={contextType} onChange={(e) => setParams({ context: e.target.value || null })} className="rounded-field border border-gray-300 px-2 py-1 text-xs">
                {CONTEXTS.map((c) => (
                  <option key={c} value={c}>
                    {CONTEXT_OPTION[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3">
              <ErrorBanner error={error} />
            </div>
          )}
          {rows === null ? (
            <p className="p-4 text-center text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <p>No conversations match these filters.</p>
              {(q || unreadOnly || contextType || status !== 'open') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    router.replace(pathname);
                  }}
                  className="mt-2 font-semibold text-gold-700 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => {
                const unread = r.unreadCount > 0;
                return (
                  <li key={r.id}>
                    <Link
                      href={hrefFor(r.id)}
                      aria-current={r.id === selectedId ? 'page' : undefined}
                      className={`block px-3 py-3 hover:bg-gray-50 ${r.id === selectedId ? 'bg-gold-100' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${unread ? 'font-bold text-navy-800' : 'font-medium text-gray-800'}`}>
                          {unread && <span aria-hidden="true" className="me-1.5 inline-block h-2 w-2 rounded-full bg-red-600" />}
                          {r.customer.displayName ?? r.customer.email}
                        </span>
                        <time dateTime={r.lastMessageAt} className="flex-shrink-0 text-[11px] text-gray-500">
                          {relativeTime(r.lastMessageAt)}
                        </time>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span dir="auto" className="truncate text-xs text-gray-500">
                          {contextLabel(r.context)} · {r.lastMessageSenderType === 'admin' ? 'You: ' : ''}
                          {r.lastMessagePreview}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-1">
                          <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                          {unread && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white" aria-label={`${r.unreadCount} unread`}>
                              {r.unreadCount > 99 ? '99+' : r.unreadCount}
                            </span>
                          )}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
              {rows.length < total && (
                <li className="p-3 text-center">
                  <button type="button" onClick={() => void loadMore()} className="text-xs font-semibold text-gold-700 underline">
                    Load more
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </aside>

      <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
        {selectedId && accessToken ? (
          <AdminSupportThread
            key={selectedId}
            conversationId={selectedId}
            accessToken={accessToken}
            socket={socket}
            connected={connected}
            canReply={canReply}
            backHref={backHref}
            onSummary={onSummary}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">Select a conversation to read and reply.</div>
        )}
      </div>
    </div>
  );
}
