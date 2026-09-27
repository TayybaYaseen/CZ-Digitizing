'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, NotificationDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/ui/Card';

// Full view of a single notification — where a click lands for types with no business page of
// their own (system_alert, admin_alert, …), so the whole message and trace id are readable.
export default function AdminNotificationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [notification, setNotification] = useState<NotificationDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setNotification(await apiFetch<NotificationDto>(`/api/admin/notifications/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load notification.', traceId: '' });
    }
  }, [accessToken, params.id]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/notifications" className="text-sm text-gray-500 hover:text-navy-800">
        ← All notifications
      </Link>

      <ErrorBanner error={error} onRetry={load} />

      {notification === null && !error ? (
        <div className="h-40 animate-pulse rounded-card bg-white shadow-cz-sm" />
      ) : notification === null ? null : (
        <Card>
          <h1 className="font-display text-2xl font-bold text-navy-800">{notification.title}</h1>
          <p className="mt-1 text-xs text-gray-400">
            {notification.notificationType.replace(/_/g, ' ')} — {new Date(notification.createdAt).toLocaleString()}
          </p>
          {notification.message && (
            <p className="mt-4 whitespace-pre-wrap break-words border-t border-gray-100 pt-4 font-mono text-sm text-gray-700">
              {notification.message}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
