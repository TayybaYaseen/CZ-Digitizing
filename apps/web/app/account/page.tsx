'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { DesignCard, type DesignSummaryDto } from '@/components/DesignCard';

// Account landing page — quick links into every owning feature's own account-area view, per
// docs/specs/2026-08-28-14-customer-account-history.md §5 (aspect A-019). Favorites (A-006d)
// persist per-account and are surfaced here directly rather than as a link, since there's no
// separate /account/favorites route.
export default function AccountPage() {
  const router = useRouter();
  const { user, isReady, accessToken, logout } = useAuth();
  const { t } = useLocale();
  const [favorites, setFavorites] = useState<DesignSummaryDto[] | null>(null);

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetch<DesignSummaryDto[]>('/api/designs/favorites', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, [user, accessToken]);

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">Signed in as {user.email}</p>
      </div>

      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
        <li>
          <Link href="/account/profile" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Profile
          </Link>
        </li>
        <li>
          <Link href="/account/orders" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Order history
          </Link>
        </li>
        <li>
          <Link href="/account/quotes" className="block px-4 py-3 text-sm hover:bg-gray-50">
            My quotes
          </Link>
        </li>
        <li>
          <Link href="/account/purchased-designs" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Purchased designs
          </Link>
        </li>
        <li>
          <Link href="/account/subscription" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Subscription
          </Link>
        </li>
        <li>
          <Link href="/account/credits" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Credits
          </Link>
        </li>
        <li>
          <Link href="/account/custom-requests" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Custom requests
          </Link>
        </li>
        <li>
          <Link href="/account/activity" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Activity
          </Link>
        </li>
        <li>
          <Link href="/account/members" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Shared account members
          </Link>
        </li>
        <li>
          <Link href="/account/notifications" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Notifications
          </Link>
        </li>
        <li>
          <Link href="/account/notifications/preferences" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Notification preferences
          </Link>
        </li>
      </ul>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Favorites</h2>
        {favorites === null ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <p className="text-sm text-gray-500">No favorites yet — tap the heart on any design to save it here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((design) => (
              <DesignCard key={design.id} design={design} />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          logout();
          router.push('/');
        }}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        Log out
      </button>
    </div>
  );
}
