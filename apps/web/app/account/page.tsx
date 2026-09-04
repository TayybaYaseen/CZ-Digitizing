'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { DesignCard, type DesignSummaryDto } from '@/components/DesignCard';

// Minimal account landing page tying together what already exists under A-002/A-004 (profile,
// notification preferences) so "My Account" in the header (A-003) resolves to something real
// instead of a 404. Purchase history lands here once A-013 (Orders) ships — still Blocked per
// docs/specs/SPEC_INDEX.md. AC-8 — favorites persist per-account and are surfaced here.
export default function AccountPage() {
  const router = useRouter();
  const { user, isReady, accessToken, logout } = useAuth();
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
        <h1 className="text-2xl font-bold">My Account</h1>
        <p className="mt-1 text-sm text-gray-600">Signed in as {user.email}</p>
      </div>

      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
        <li>
          <Link href="/account/orders" className="block px-4 py-3 text-sm hover:bg-gray-50">
            Order history
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
