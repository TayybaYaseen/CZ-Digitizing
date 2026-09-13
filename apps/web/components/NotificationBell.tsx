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
      aria-label="Notifications"
      className="relative flex-shrink-0 whitespace-nowrap rounded-field border border-brand-silver/30 px-2 py-1.5 text-xs text-brand-silver hover:bg-white/5 sm:px-3 sm:text-sm"
    >
      {/* Label shows from `sm` up; below that only the bell glyph + badge remain, so this control
          stays compact in the header's right-hand cluster on small phones. Link, count polling,
          and destination are unchanged either way. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4 w-4 sm:hidden"
      >
        <path
          d="M10 2.5c-2.3 0-4 1.9-4 4.2v2.1c0 .5-.2 1.3-.5 1.8l-1 1.7c-.6 1 0 2.3 1.1 2.6 3 .9 6.8.9 9.8 0 1-.3 1.6-1.5 1.1-2.6l-1-1.7c-.3-.5-.5-1.3-.5-1.8V6.7c0-2.3-1.7-4.2-4-4.2z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8 17a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="hidden sm:inline">Notifications</span>
      {!!count && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white sm:static sm:ml-2 sm:h-5 sm:min-w-5 sm:text-xs">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
