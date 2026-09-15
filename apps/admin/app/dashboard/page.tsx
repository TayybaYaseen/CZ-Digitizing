'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/ui/Card';
import { Kpi } from '@/components/ui/Kpi';

// Mirrors apps/api/src/settings/dto/dashboard-stats.dto.ts's DashboardStatsDto.
interface DashboardRecentOrderDto {
  orderId: string;
  customerName: string | null;
  totalPkr: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

interface DashboardStatsDto {
  recentOrders: DashboardRecentOrderDto[];
  monthlyRevenuePkr: { month: string; revenuePkr: number }[];
  topDesigns: { designId: string; name: string; unitsSold: number }[];
  recentCustomers: { customerId: string; name: string | null; registeredAt: string }[];
  unreadNotificationCount: number;
  visibleSections: string[];
}

function formatMonthLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

interface DesignSummary {
  id: string;
  name: string;
  previewImageUrl: string;
}

function CardSkeleton() {
  return <div className="h-40 animate-pulse rounded-card bg-white shadow-cz-sm" />;
}

// docs/CZ Digitizing Admin Panel.html's decoded DashboardView — KPI row + Revenue/Recent-Orders/
// Top-Designs split, all backed by real Orders/OrderItems data now that A-013 has shipped (see
// docs/specs/SPEC_INDEX.md's incident note on this fix for why this page previously said Orders
// "hasn't shipped" long after it had).
export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [stats, setStats] = useState<DashboardStatsDto | null>(null);
  const [recentDesigns, setRecentDesigns] = useState<DesignSummary[] | null>(null);
  const [designCount, setDesignCount] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const [dto, designs] = await Promise.all([
        apiFetch<DashboardStatsDto>('/api/admin/dashboard/stats', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetchWithMeta<DesignSummary[]>('/api/designs?sort=newest&pageSize=5', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setStats(dto);
      setRecentDesigns(designs.data);
      setDesignCount(designs.meta?.total ?? designs.data.length);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard.', traceId: '' });
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  const visible = (section: string) => stats?.visibleSections.includes(section) ?? false;

  return (
    <div className="max-w-[1440px] space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back, {user.displayName ?? user.email}</p>
      </div>

      <ErrorBanner error={error} />

      {stats === null && !error ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : stats === null ? null : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {visible('notifications') && <Kpi label="Unread Notifications" value={String(stats.unreadNotificationCount)} accent />}
            {visible('designs') && <Kpi label="Total Designs" value={String(designCount ?? 0)} />}
            {visible('customers') && <Kpi label="Recent Customer Signups" value={String(stats.recentCustomers.length)} />}
          </div>

          {visible('revenue') && (
            <Card title="Monthly Revenue">
              {stats.monthlyRevenuePkr.every((m) => m.revenuePkr === 0) ? (
                <p className="text-sm text-gray-400">No revenue yet.</p>
              ) : (
                <div className="grid grid-cols-6 items-end gap-3">
                  {(() => {
                    const max = Math.max(...stats.monthlyRevenuePkr.map((m) => m.revenuePkr), 1);
                    return stats.monthlyRevenuePkr.map((m) => (
                      <div key={m.month} className="flex flex-col items-center gap-1.5">
                        <div className="flex h-24 w-full items-end">
                          <div className="w-full rounded-t bg-gold-500" style={{ height: `${(m.revenuePkr / max) * 100}%` }} title={`Rs ${m.revenuePkr}`} />
                        </div>
                        <span className="text-xs text-gray-400">{formatMonthLabel(m.month)}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
            {visible('orders') && (
              <Card title="Recent Orders">
                {stats.recentOrders.length === 0 ? (
                  <p className="text-sm text-gray-400">No orders yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {stats.recentOrders.map((o) => (
                      <li key={o.orderId}>
                        <button
                          onClick={() => router.push(`/orders/${o.orderId}`)}
                          className="flex w-full items-center justify-between py-2.5 text-left text-sm text-gray-700 hover:text-gold-600"
                        >
                          <span>
                            <span className="font-medium text-navy-800">Order #{o.orderId}</span>{' '}
                            <span className="text-gray-400">· {o.customerName ?? 'Unknown customer'}</span>
                          </span>
                          <span className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">{o.paymentStatus}</span>
                            <span className="font-semibold text-navy-800">Rs {o.totalPkr}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {visible('designs') && (
              <Card title="Recently Added Designs" action={<button onClick={() => router.push('/designs')} className="text-xs font-semibold text-gold-600 hover:underline">View All</button>}>
                {recentDesigns === null ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : recentDesigns.length === 0 ? (
                  <p className="text-sm text-gray-400">No designs yet.</p>
                ) : (
                  <div className="grid gap-4">
                    {recentDesigns.map((d) => (
                      <div key={d.id} className="flex items-center gap-3.5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumb, arbitrary URL */}
                        <img src={d.previewImageUrl} alt="" className="h-11 w-11 flex-shrink-0 rounded-field object-cover" />
                        <span className="truncate text-sm font-semibold text-navy-800">{d.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {visible('orders') && visible('designs') && (
            <Card title="Top-Selling Designs">
              {stats.topDesigns.length === 0 ? (
                <p className="text-sm text-gray-400">No sales yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.topDesigns.map((d) => (
                    <li key={d.designId}>
                      <button
                        onClick={() => router.push(`/designs/${d.designId}`)}
                        className="flex w-full items-center justify-between py-2.5 text-left text-sm text-gray-700 hover:text-gold-600"
                      >
                        <span className="font-medium text-navy-800">{d.name}</span>
                        <span className="text-xs text-gray-400">{d.unitsSold} sold</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {visible('customers') && (
            <Card title="Recent Customer Signups">
              {stats.recentCustomers.length === 0 ? (
                <p className="text-sm text-gray-400">No customers yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.recentCustomers.map((c) => (
                    <li key={c.customerId}>
                      <button
                        onClick={() => router.push(`/customers/${c.customerId}`)}
                        className="flex w-full items-center justify-between py-2.5 text-left text-sm text-gray-700 hover:text-gold-600"
                      >
                        <span className="font-medium">{c.name ?? c.customerId}</span>
                        <span className="text-xs text-gray-400">{new Date(c.registeredAt).toLocaleDateString()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
