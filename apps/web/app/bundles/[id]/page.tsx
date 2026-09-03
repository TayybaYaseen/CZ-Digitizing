'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useCart } from '@/lib/cart-context';
import { ErrorBanner } from '@/components/ErrorBanner';

// Mirrors apps/api/src/bundles/dto/bundle.dto.ts's BundleDetailDto.
interface BundleDetailDto {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
  pricePkr: number;
  salePricePkr: number | null;
  includedDesigns: { id: string; name: string; previewImageUrl: string; pricePkr: number; priceOverridePkr: number | null }[];
}

// spec §5 — clicking a bundle card opens this detail listing included designs.
export default function BundleDetailPage() {
  const params = useParams<{ id: string }>();
  const { addItem } = useCart();
  const [bundle, setBundle] = useState<BundleDetailDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    apiFetch<BundleDetailDto>(`/api/bundles/${params.id}`)
      .then(setBundle)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load bundle.', traceId: '' }));
  }, [params.id]);

  async function onAddToCart() {
    if (!bundle) return;
    setAddError(null);
    setAdding(true);
    try {
      await addItem({ bundleId: bundle.id, quantity: 1 });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setAddError(err instanceof ApiClientError ? err.error.message : 'Failed to add to cart.');
    } finally {
      setAdding(false);
    }
  }

  if (error) return <ErrorBanner error={error} />;
  if (!bundle) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="h-96 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {bundle.previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL
          <img src={bundle.previewImageUrl} alt={bundle.name} className="w-full rounded-lg border border-gray-200 object-cover" />
        ) : (
          <div className="h-64 w-full rounded-lg border border-gray-200 bg-brand-lightGray" />
        )}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">{bundle.name}</h1>
          <p className="text-lg">
            {bundle.salePricePkr ? (
              <>
                <span className="font-semibold">Rs {bundle.salePricePkr}</span>{' '}
                <span className="text-sm text-gray-400 line-through">Rs {bundle.pricePkr}</span>
              </>
            ) : (
              <span className="font-semibold">Rs {bundle.pricePkr}</span>
            )}
          </p>
          {bundle.description && <p className="text-sm text-gray-600">{bundle.description}</p>}
          <p className="text-sm text-gray-500">{bundle.includedDesigns.length} design{bundle.includedDesigns.length === 1 ? '' : 's'} included</p>

          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <button
            onClick={onAddToCart}
            disabled={adding}
            className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
          >
            {added ? 'Added ✓' : adding ? 'Adding…' : 'Add to Cart'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Included designs</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {bundle.includedDesigns.map((d) => (
            <div key={d.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL */}
              <img src={d.previewImageUrl} alt={d.name} className="h-32 w-full object-cover" />
              <div className="p-2">
                <p className="text-xs font-medium text-brand-navy">{d.name}</p>
                <p className="text-xs text-gray-500">Rs {d.priceOverridePkr ?? d.pricePkr}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
