'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

interface ActivityEventDto {
  id: string;
  eventType: 'VIEWED' | 'ADDED_TO_CART' | 'REMOVED_FROM_CART' | 'PURCHASED' | 'PAID' | 'DOWNLOADED';
  designId?: string;
  orderId?: string;
  createdAt: string;
}

const EVENT_LABEL: Record<ActivityEventDto['eventType'], string> = {
  VIEWED: 'Viewed a design',
  ADDED_TO_CART: 'Added to cart',
  REMOVED_FROM_CART: 'Removed from cart',
  PURCHASED: 'Placed an order',
  PAID: 'Payment confirmed',
  DOWNLOADED: 'Downloaded a file',
};

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-13 — GET
// /api/users/activity, reverse-chronological.
export default function ActivityPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [events, setEvents] = useState<ActivityEventDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetch<ActivityEventDto[]>('/api/users/activity?page=1&pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setEvents)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load activity.', traceId: '' }));
  }, [user, accessToken]);

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="mt-1 text-sm text-gray-600">Recently viewed, cart activity, and order history.</p>
      </div>

      <ErrorBanner error={error} />

      {events === null ? (
        <p className="text-center text-sm text-gray-500">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>No activity yet — browse a design to get started.</p>
          <Link href="/designs" className="mt-2 inline-block text-brand-navy underline">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{EVENT_LABEL[e.eventType]}</p>
                <p className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</p>
              </div>
              {e.orderId && (
                <Link href={`/order-confirmation/${e.orderId}`} className="text-xs text-brand-navy underline">
                  Order #{e.orderId}
                </Link>
              )}
              {!e.orderId && e.designId && (
                <Link href={`/designs/${e.designId}`} className="text-xs text-brand-navy underline">
                  View design
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
