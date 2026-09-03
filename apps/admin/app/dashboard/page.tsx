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
interface DashboardStatsDto {
  recentOrders: unknown[];
  monthlyRevenuePkr: { month: string; revenuePkr: number }[];
  topDesigns: { designId: string; name: string; unitsSold: number }[];
  recentCustomers: { customerId: string; name: string | null; registeredAt: string }[];
  unreadNotificationCount: number;
  visibleSections: string[];
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
// Top-Designs split. AC-12's "top-selling designs" and "monthly revenue" need Orders (A-013,
// Blocked) — this ships "Recently Added Designs" as an honest, real substitute instead of faking
// sales figures, plus documented empty states for what genuinely isn't buildable yet.
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
              {/* TODO(A-013): real chart once Orders exists */}
              <p className="text-sm text-gray-400">No revenue data yet — Orders & Payment Processing hasn&apos;t shipped.</p>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
            {visible('orders') && (
              <Card title="Recent Orders">
                {/* TODO(A-013): real rows once Orders exists — orders/checkout is still Blocked */}
                <p className="text-sm text-gray-400">No orders yet — Orders & Payment Processing hasn&apos;t shipped.</p>
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
