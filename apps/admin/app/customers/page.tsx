'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/ui/Card';

interface CustomerDto {
  id: string;
  email: string;
  displayName: string | null;
  gmailVerified: boolean;
}

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-14 — lets Admin
// find the customer whose activity/history they want to look up. Replaces the ComingSoon
// placeholder now that A-019 has shipped.
export default function CustomersPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [customers, setCustomers] = useState<CustomerDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const query = new URLSearchParams({ page: '1', pageSize: '50', ...(search ? { search } : {}) });
      const list = await apiFetch<CustomerDto[]>(`/api/admin/customers?${query.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setCustomers(list);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load customers.', traceId: '' });
    }
  }, [accessToken, search]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy-800">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">{customers?.length ?? 0} customers</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="rounded-field border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      <ErrorBanner error={error} />

      <Card padding="p-0">
        {customers === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No customers found.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3 text-gray-500">{c.displayName ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${c.id}`} className="text-sm font-semibold text-navy-800 underline">
                      View
                    </Link>
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
