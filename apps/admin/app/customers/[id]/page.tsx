'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/ui/Card';

interface CustomerDto {
  id: string;
  email: string;
  displayName: string | null;
  createdAt?: string;
}

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

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-14 — Admin's
// Customer Activity panel, GET /api/admin/customers/:id/activity. Replaces the ComingSoon
// placeholder now that A-019 has shipped.
export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [activity, setActivity] = useState<ActivityEventDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!accessToken) return;
    apiFetch<CustomerDto>(`/api/admin/customers/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setCustomer)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load customer.', traceId: '' }));
    apiFetch<ActivityEventDto[]>(`/api/admin/customers/${params.id}/activity?page=1&pageSize=50`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setActivity)
      .catch(() => setActivity([]));
  }, [isReady, user, accessToken, params.id, router]);

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">{customer?.displayName ?? customer?.email ?? `Customer #${params.id}`}</h1>
        {customer && <p className="mt-1 text-sm text-gray-500">{customer.email}</p>}
      </div>

      <ErrorBanner error={error} />

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-navy-800">Activity timeline</h2>
        {activity === null ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-400">No recorded activity yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activity.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-navy-800">{EVENT_LABEL[e.eventType]}</p>
                  <p className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</p>
                </div>
                {e.orderId && <span className="text-xs text-gray-500">Order #{e.orderId}</span>}
                {!e.orderId && e.designId && <span className="text-xs text-gray-500">Design #{e.designId}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
