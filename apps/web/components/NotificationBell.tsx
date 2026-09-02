'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const POLL_INTERVAL_MS = 30_000;

// Spec §5 — "badge count shows last-known value until refreshed"; a failed poll just keeps
// showing whatever count we last had rather than resetting to 0 or an error state.
export function NotificationBell() {
  const { user, accessToken } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !accessToken) return;

    let cancelled = false;
    async function poll() {
      try {
        const { count } = await apiFetch<{ count: number }>('/api/notifications/unread-count', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!cancelled) setCount(count);
      } catch {
        // keep last-known count
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, accessToken]);

  if (!user) return null;

  return (
    <Link
      href="/account/notifications"
      className="relative inline-flex items-center rounded-lg border border-brand-silver/30 px-3 py-1.5 text-sm text-brand-silver hover:bg-white/5"
    >
      Notifications
      {!!count && (
        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
