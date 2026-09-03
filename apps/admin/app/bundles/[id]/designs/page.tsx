'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { inputClass } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface BundleDto {
  id: string;
  name: string;
}

// Mirrors apps/api/src/bundles/dto/bundle.dto.ts's BundleDetailDto.
interface BundleDetailDto extends BundleDto {
  includedDesigns: { id: string; name: string; previewImageUrl: string; pricePkr: number; priceOverridePkr: number | null }[];
}

interface DesignSummaryDto {
  id: string;
  name: string;
  previewImageUrl: string;
  pricePkr: number;
}

// docs/specs/2026-08-28-06-design-bundles.md AC-1/AC-7 — manages bundle_designs membership via
// POST/DELETE /api/bundles/:id/designs/:designId, plus an optional per-design price override.
// Mirrors apps/admin/app/designs/[id]/files/page.tsx's nested-resource pattern.
export default function BundleDesignsAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [bundle, setBundle] = useState<BundleDetailDto | null>(null);
  const [allDesigns, setAllDesigns] = useState<DesignSummaryDto[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [listError, setListError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const [bundleDto, designList] = await Promise.all([
        apiFetch<BundleDetailDto>(`/api/bundles/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<DesignSummaryDto[]>('/api/designs?pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setBundle(bundleDto);
      setAllDesigns(designList);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load bundle.', traceId: '' });
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

  async function onAdd() {
    if (!selectedDesignId) return;
    setActionError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/api/bundles/${params.id}/designs/${selectedDesignId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(priceOverride ? { priceOverridePkr: Number(priceOverride) } : {}),
      });
      setSuccessMessage('Design added to bundle.');
      setSelectedDesignId('');
      setPriceOverride('');
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to add design.', traceId: '' });
    }
  }

  async function onRemove(designId: string) {
    setActionError(null);
    try {
      await apiFetch(`/api/bundles/${params.id}/designs/${designId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to remove design.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  const includedIds = new Set(bundle?.includedDesigns.map((d) => d.id) ?? []);
  const availableDesigns = allDesigns.filter((d) => !includedIds.has(d.id));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/bundles" className="text-sm text-gray-500 hover:underline">
          ← Bundles
        </Link>
        <h1 className="font-display text-3xl font-bold text-navy-800">{bundle ? `Designs — ${bundle.name}` : 'Designs'}</h1>
        <p className="mt-1 text-sm text-gray-500">Bundle membership and per-design price overrides (AC-1/AC-4/AC-7)</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={actionError} />

      <Card title="Add a design">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm text-gray-600">
            Design
            <select value={selectedDesignId} onChange={(e) => setSelectedDesignId(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">Select a design…</option>
              {availableDesigns.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (Rs {d.pricePkr})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Price override (PKR)
            <input
              type="number"
              step="0.01"
              placeholder="optional"
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              className={`${inputClass} mt-1 w-40`}
            />
          </label>
          <Button variant="primary" size="sm" disabled={!selectedDesignId} onClick={onAdd}>
            Add
          </Button>
        </div>
      </Card>

      <Card padding="p-0">
        {bundle === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : bundle.includedDesigns.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No designs in this bundle yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">Design Name</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {bundle.includedDesigns.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview thumb, arbitrary external URL */}
                    <img src={d.previewImageUrl} alt="" className="h-11 w-11 rounded-field object-cover" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{d.name}</td>
                  <td className="px-4 py-3">
                    Rs {d.priceOverridePkr ?? d.pricePkr}
                    {d.priceOverridePkr !== null && <span className="ml-1 text-xs text-gray-400 line-through">Rs {d.pricePkr}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outlineNavy" size="sm" onClick={() => onRemove(d.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
