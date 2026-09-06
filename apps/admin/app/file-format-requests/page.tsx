'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, FileFormatRequestDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-6 (aspect A-017a) — "Need Another File
// Format?" admin inbox.
export default function FileFormatRequestsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [items, setItems] = useState<FileFormatRequestDto[] | null>(null);
  const [fulfillFiles, setFulfillFiles] = useState<Record<string, File | undefined>>({});
  const [listError, setListError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const list = await apiFetch<FileFormatRequestDto[]>('/api/file-format-requests', { headers: { Authorization: `Bearer ${accessToken}` } });
      setItems(list);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load file-format requests.', traceId: '' });
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  async function onFulfill(req: FileFormatRequestDto) {
    const file = fulfillFiles[req.id];
    if (!file) return;
    setActionError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      await apiFetch(`/api/file-format-requests/${req.id}/fulfill`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body });
      setSuccessMessage(`Fulfilled request #${req.id} for order #${req.orderId}.`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to fulfill request.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">File Format Requests</h1>
        <p className="mt-1 text-sm text-gray-500">Customer requests for an additional file format on an already-purchased order.</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={actionError} />

      <Card padding="p-0">
        {items === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No file-format requests yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((req) => (
              <li key={req.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium text-navy-800">
                    Order #{req.orderId} — requested <span className="uppercase">{req.requestedFormat}</span>
                  </p>
                  {req.notes && <p className="text-xs text-gray-500">{req.notes}</p>}
                  <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>

                {req.status === 'fulfilled' ? (
                  <span className="text-xs font-medium text-emerald-700">Fulfilled</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="file" onChange={(e) => setFulfillFiles((prev) => ({ ...prev, [req.id]: e.target.files?.[0] }))} className="text-xs" />
                    <Button size="sm" onClick={() => onFulfill(req)} disabled={!fulfillFiles[req.id]}>
                      Fulfill
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
