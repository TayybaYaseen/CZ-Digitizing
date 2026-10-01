'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, NotificationDto } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { publishUnreadCountDelta } from '@/lib/unread-count-bus';
import { getNotificationHref } from '@/lib/notification-link';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

const PAGE_SIZE = 20;

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

// i18n (A-021): each notification's title/message are written by the API when the event happens and
// stored as-is (English), so they're shown verbatim — see docs/i18n.md. The type label and every
// piece of surrounding UI chrome here are translated.
export default function NotificationsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { t, tOr, formatDateTime } = useLocale();

  const [notifications, setNotifications] = useState<NotificationDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  const loadNotifications = useCallback(
    async (targetPage: number) => {
      if (!accessToken) return;
      setListError(null);
      try {
        const { data, meta } = await apiFetchWithMeta<NotificationDto[]>(
          `/api/notifications?page=${targetPage}&pageSize=${PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setNotifications(data);
        setTotal(meta?.total ?? data.length);
        setPage(targetPage);
      } catch (err) {
        setListError(
          err instanceof ApiClientError
            ? err.error
            : clientError('errors.loadNotificationsFailed'),
        );
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) {
      router.replace('/login');
      return;
    }
    loadNotifications(1);
  }, [isReady, user, loadNotifications, router]);

  // AC-1 §5 "mark-as-read on open" — called both when a row is clicked/opened and from the
  // explicit "Mark read" button below (kept for an unambiguous, deliberate action). No-ops if
  // already read.
  async function onMarkRead(id: string) {
    if (notifications?.find((n) => n.id === id)?.isRead) return;
    setActionError(null);
    try {
      await apiFetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)) ?? null);
      publishUnreadCountDelta(-1); // AC-8 — badge updates immediately, not on the next 30s poll
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.error : clientError('errors.markReadFailed'),
      );
    }
  }

  // Opening a notification marks it read and takes the customer to the page it's about (orders,
  // quotes, custom requests, …). The mark-read request isn't awaited so navigation feels instant;
  // the badge bus lives in the layout, so its decrement still lands after this page unmounts.
  function onOpen(n: NotificationDto) {
    void onMarkRead(n.id);
    const href = getNotificationHref(n);
    if (href) router.push(href);
  }

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('notifications.subtitle')}</p>
        </div>
        {/* AC-9 — dedicated preference center, kept separate from the unsubscribe landing page at
            /account/notifications/preferences (see that page's own doc comment). */}
        <Link
          href="/account/notifications/settings"
          className="flex-shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t('account.notificationPreferences')}
        </Link>
      </div>

      <ErrorBanner error={actionError} />
      <ErrorBanner error={listError} onRetry={() => loadNotifications(page)} />

      {notifications === null && !listError ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </ul>
      ) : notifications === null ? null : notifications.length === 0 ? (
        <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-gray-500">
          {t('notifications.allCaughtUp')}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => onOpen(n)}
                className={`flex items-start justify-between gap-4 px-4 py-3 ${n.isRead ? '' : 'bg-brand-gold/10'} ${
                  !n.isRead || getNotificationHref(n) ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-navy" aria-label={t('notifications.unread')} />}
                    <p dir="auto" className="truncate text-sm font-medium text-gray-900">{n.title}</p>
                  </div>
                  {n.message && <p dir="auto" className="mt-0.5 text-sm text-gray-600">{n.message}</p>}
                  <p className="mt-1 text-xs text-gray-400">
                    {tOr(`notificationType.${n.notificationType}`, humanize(n.notificationType))} — {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(n.id);
                    }}
                    className="flex-shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {t('notifications.markRead')}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <button
                disabled={page <= 1}
                onClick={() => loadNotifications(page - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <span>{t('common.pageOf', { page, total: totalPages })}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => loadNotifications(page + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
