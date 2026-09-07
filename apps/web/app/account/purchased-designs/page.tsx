'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

interface PurchasedDesignDto {
  type: 'design' | 'bundle';
  id: string;
  name: string;
  previewImageUrl: string | null;
  purchases: { orderId: string; purchasedAt: string }[];
}

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-2 — GET
// /api/users/purchased-designs aggregates across every order, de-duplicated per design/bundle. The
// actual download action is a link into /order-confirmation/:orderId (which itself links to
// GET /api/orders/:id/files — A-007's existing authorization flow) rather than duplicating that
// authorization logic here, per this spec's own "aggregation, not new business logic" scope (§3).
export default function PurchasedDesignsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [items, setItems] = useState<PurchasedDesignDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetch<PurchasedDesignDto[]>('/api/users/purchased-designs', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setItems)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load purchased designs.', traceId: '' }));
  }, [user, accessToken]);

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Purchased Designs</h1>
        <p className="mt-1 text-sm text-gray-600">Every design or bundle you&apos;ve bought, across all your orders.</p>
      </div>

      <ErrorBanner error={error} />

      {items === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>You haven&apos;t ordered anything yet — browse designs.</p>
          <Link href="/designs" className="mt-2 inline-block text-brand-navy underline">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item) => {
            // purchases is always non-empty — the aggregation only ever creates a row from at
            // least one order_item (account.service.ts's listPurchasedDesigns).
            const latest = [...item.purchases].sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime())[0]!;
            return (
              <li key={`${item.type}:${item.id}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                {item.previewImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL
                  <img src={item.previewImageUrl} alt={item.name} className="h-28 w-full object-cover" />
                )}
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-brand-navy">{item.name}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{item.type}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Bought {item.purchases.length} time{item.purchases.length === 1 ? '' : 's'}
                  </p>
                  <Link href={`/order-confirmation/${latest.orderId}`} className="mt-2 inline-block text-xs font-medium text-brand-navy underline">
                    View files (order #{latest.orderId})
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
