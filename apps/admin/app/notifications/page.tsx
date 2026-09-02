'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, NotificationDto } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

const PAGE_SIZE = 20;

function humanize(type: string) {
  return type.replace(/_/g, ' ');
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
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
          `/api/admin/notifications?page=${targetPage}&pageSize=${PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setNotifications(data);
        setTotal(meta?.total ?? data.length);
        setPage(targetPage);
      } catch (err) {
        setListError(
          err instanceof ApiClientError
            ? err.error
            : { code: 'INTERNAL_ERROR', message: 'Failed to load notifications.', traceId: '' },
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

  async function onMarkRead(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/api/admin/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)) ?? null);
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to mark as read.', traceId: '' },
      );
    }
  }

  async function onDelete(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotifications((prev) => prev?.filter((n) => n.id !== id) ?? null);
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setActionError(
        err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' },
      );
    }
  }

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-gray-400">
          New quotes, orders, payments needing attention, registrations, unanswered Taebo questions,
          and system alerts.
        </p>
      </div>

      <ErrorBanner error={actionError} />
      <ErrorBanner error={listError} />

      {notifications === null && !listError ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-md border border-gray-800 bg-gray-900" />
          ))}
        </ul>
      ) : notifications === null ? null : notifications.length === 0 ? (
        <p className="rounded-md border border-gray-800 px-4 py-6 text-center text-sm text-gray-400">
          You&apos;re all caught up.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-800 rounded-md border border-gray-800">
            {notifications.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${n.isRead ? '' : 'bg-gray-900'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-gold" aria-label="unread" />}
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  </div>
                  {n.message && <p className="mt-0.5 text-sm text-gray-400">{n.message}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {humanize(n.notificationType)} — {formatTimestamp(n.createdAt)}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  {!n.isRead && (
                    <button
                      onClick={() => onMarkRead(n.id)}
                      className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(n.id)}
                    className="rounded-md border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-400">
              <button
                disabled={page <= 1}
                onClick={() => loadNotifications(page - 1)}
                className="rounded-md border border-gray-800 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => loadNotifications(page + 1)}
                className="rounded-md border border-gray-800 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
