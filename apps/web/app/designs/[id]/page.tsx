'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { DesignCard, type DesignSummaryDto } from '@/components/DesignCard';
import { ErrorBanner } from '@/components/ErrorBanner';

// Mirrors apps/api/src/designs/dto/design.dto.ts's DesignDetailDto.
interface DesignDetailDto {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string;
  galleryImageUrls: string[];
  pricePkr: number;
  salePricePkr: number | null;
  sizes: { id: string; label: string; widthMm: number; heightMm: number }[];
  stitchCount: number | null;
  threadColorCount: number | null;
  threadColorChanges: number | null;
  tags: string[];
}

// AC-4's full detail view. AC-11 (Customers also bought) queries a real endpoint that currently
// returns [] — co-purchase data needs Orders (A-013, still Blocked). AC-12 (HLS video) is a
// documented stub — HLS needs the video pipeline (architecture §File Management), which doesn't
// exist yet.
export default function DesignDetailPage() {
  const params = useParams<{ id: string }>();
  const [design, setDesign] = useState<DesignDetailDto | null>(null);
  const [related, setRelated] = useState<DesignSummaryDto[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<DesignDetailDto>(`/api/designs/${params.id}`)
      .then(setDesign)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load design.', traceId: '' }));
    apiFetch<DesignSummaryDto[]>(`/api/designs/${params.id}/related`)
      .then(setRelated)
      .catch(() => setRelated([]));
  }, [params.id]);

  if (error) return <ErrorBanner error={error} />;
  if (!design) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="h-96 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL */}
        <img src={design.previewImageUrl} alt={design.name} className="w-full rounded-lg border border-gray-200 object-cover" />
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">{design.name}</h1>
          <p className="text-lg">
            {design.salePricePkr ? (
              <>
                <span className="font-semibold">Rs {design.salePricePkr}</span>{' '}
                <span className="text-sm text-gray-400 line-through">Rs {design.pricePkr}</span>
              </>
            ) : (
              <span className="font-semibold">Rs {design.pricePkr}</span>
            )}
          </p>
          {design.description && <p className="text-sm text-gray-600">{design.description}</p>}

          <div>
            <p className="text-sm font-medium">Sizes</p>
            <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
              {design.sizes.map((s) => (
                <li key={s.id}>
                  {s.label}: {s.widthMm}×{s.heightMm}mm
                </li>
              ))}
            </ul>
          </div>

          {(design.stitchCount !== null || design.threadColorCount !== null) && (
            <div className="text-sm text-gray-600">
              {design.stitchCount !== null && <p>Stitch count: {design.stitchCount}</p>}
              {design.threadColorCount !== null && <p>Thread colors: {design.threadColorCount}</p>}
              {design.threadColorChanges !== null && <p>Thread color changes: {design.threadColorChanges}</p>}
            </div>
          )}

          {/* TODO(A-011): Shopping Cart doesn't exist yet — button is a stub. */}
          <button className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy">Add to Cart</button>
        </div>
      </div>

      {/* AC-11 — "Customers also bought". Real co-purchase computation needs Orders (A-013,
          Blocked); the endpoint is real and simply returns [] until then, so this section renders
          nothing rather than a fabricated list. */}
      {related.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Customers also bought</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {related.map((r) => (
              <DesignCard key={r.id} design={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
