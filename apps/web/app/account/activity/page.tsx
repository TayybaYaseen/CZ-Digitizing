'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';
import { useLocale, type TranslationKey } from '@/lib/locale-context';

interface ActivityEventDto {
  id: string;
  eventType: 'VIEWED' | 'ADDED_TO_CART' | 'REMOVED_FROM_CART' | 'PURCHASED' | 'PAID' | 'DOWNLOADED';
  designId?: string;
  orderId?: string;
  createdAt: string;
}

const EVENT_LABEL: Record<ActivityEventDto['eventType'], TranslationKey> = {
  VIEWED: 'activity.viewed',
  ADDED_TO_CART: 'activity.addedToCart',
  REMOVED_FROM_CART: 'activity.removedFromCart',
  PURCHASED: 'activity.purchased',
  PAID: 'activity.paid',
  DOWNLOADED: 'activity.downloaded',
};

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-13 — GET
// /api/users/activity, reverse-chronological.
export default function ActivityPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { t, formatDateTime } = useLocale();
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
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.loadActivityFailed')));
  }, [user, accessToken]);

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('account.activity')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('activity.subtitle')}</p>
      </div>

      <ErrorBanner error={error} />

      {events === null ? (
        <p className="text-center text-sm text-gray-500">{t('common.loading')}</p>
      ) : events.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>{t('activity.empty')}</p>
          <Link href="/designs" className="mt-2 inline-block text-brand-navy underline">
            {t('orders.browseCatalog')}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{t(EVENT_LABEL[e.eventType])}</p>
                <p className="text-xs text-gray-500">{formatDateTime(e.createdAt)}</p>
              </div>
              {e.orderId && (
                <Link href={`/order-confirmation/${e.orderId}`} className="text-xs text-brand-navy underline">
                  {t('orders.orderId', { id: e.orderId })}
                </Link>
              )}
              {!e.orderId && e.designId && (
                <Link href={`/designs/${e.designId}`} className="text-xs text-brand-navy underline">
                  {t('activity.viewDesign')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
