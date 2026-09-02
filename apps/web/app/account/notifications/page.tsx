'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, NotificationDto, NotificationPreferenceDto } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';

const PAGE_SIZE = 20;

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();

  const [notifications, setNotifications] = useState<NotificationDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  const [preferences, setPreferences] = useState<NotificationPreferenceDto[] | null>(null);
  const [prefError, setPrefError] = useState<ApiError | null>(null);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

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
            : { code: 'INTERNAL_ERROR', message: 'Failed to load notifications.', traceId: '' },
        );
      }
    },
    [accessToken],
  );

  const loadPreferences = useCallback(async () => {
    if (!accessToken) return;
    setPrefError(null);
    try {
      const matrix = await apiFetch<NotificationPreferenceDto[]>('/api/notifications/preferences', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setPreferences(matrix);
    } catch (err) {
      setPrefError(
        err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load preferences.', traceId: '' },
      );
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) {
      router.replace('/login');
      return;
    }
    loadNotifications(1);
    loadPreferences();
  }, [isReady, user, loadNotifications, loadPreferences, router]);

  async function onMarkRead(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/api/notifications/${id}/read`, {
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

  function togglePreference(notificationType: string, channel: string) {
    setPreferences((prev) =>
      prev?.map((p) => (p.notificationType === notificationType && p.channel === channel ? { ...p, enabled: !p.enabled } : p)) ?? null,
    );
  }

  async function onSavePreferences() {
    if (!preferences) return;
    setSavingPrefs(true);
    setPrefError(null);
    setPrefSuccess(null);
    try {
      await apiFetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ preferences }),
      });
      setPrefSuccess('Preferences saved.');
    } catch (err) {
      setPrefError(
        err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save preferences.', traceId: '' },
      );
    } finally {
      setSavingPrefs(false);
    }
  }

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Group the flat type×channel matrix by notificationType for a compact toggle grid.
  const groupedPrefs = preferences
    ? Array.from(new Set(preferences.map((p) => p.notificationType))).map((type) => ({
        type,
        entries: preferences.filter((p) => p.notificationType === type),
      }))
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">Order updates, payments, files ready, and quote responses.</p>
        </div>

        <ErrorBanner error={actionError} />
        <ErrorBanner error={listError} />

        {notifications === null && !listError ? (
          <ul className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
            ))}
          </ul>
        ) : notifications === null ? null : notifications.length === 0 ? (
          <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-gray-500">
            You&apos;re all caught up.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start justify-between gap-4 px-4 py-3 ${n.isRead ? '' : 'bg-brand-gold/10'}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-navy" aria-label="unread" />}
                      <p className="truncate text-sm font-medium text-gray-900">{n.title}</p>
                    </div>
                    {n.message && <p className="mt-0.5 text-sm text-gray-600">{n.message}</p>}
                    <p className="mt-1 text-xs text-gray-400">
                      {humanize(n.notificationType)} — {formatTimestamp(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => onMarkRead(n.id)}
                      className="flex-shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Mark read
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
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => loadNotifications(page + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Notification preferences</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose which channels you want to hear from us on, per notification type.
          </p>
        </div>

        {prefSuccess && <SuccessBanner message={prefSuccess} />}
        <ErrorBanner error={prefError} />

        {preferences === null && !prefError ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : preferences === null ? null : (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-gray-500">
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Channel</th>
                    <th className="px-4 py-2">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedPrefs.map(({ type, entries }) =>
                    entries.map((entry, idx) => (
                      <tr key={`${entry.notificationType}:${entry.channel}`} className="border-b border-slate-100 last:border-0">
                        {idx === 0 && (
                          <td className="px-4 py-2 align-top font-medium text-gray-900" rowSpan={entries.length}>
                            {humanize(type)}
                          </td>
                        )}
                        <td className="px-4 py-2 text-gray-600">{humanize(entry.channel)}</td>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={() => togglePreference(entry.notificationType, entry.channel)}
                          />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>

            <button
              onClick={onSavePreferences}
              disabled={savingPrefs}
              className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navyLight disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPrefs ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
