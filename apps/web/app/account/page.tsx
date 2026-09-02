'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

// Minimal account landing page tying together what already exists under A-002/A-004 (profile,
// notification preferences) so "My Account" in the header (A-003) resolves to something real
// instead of a 404. Purchase history, favorites, etc. land here once their owning aspects
// (A-013, A-006d, ...) are built — still Blocked per docs/specs/SPEC_INDEX.md.
export default function AccountPage() {
  const router = useRouter();
  const { user, isReady, logout } = useAuth();

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) router.replace('/login');
  }, [isReady, user, router]);

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Account</h1>
        <p className="mt-1 text-sm text-gray-600">Signed in as {user.email}</p>
      </div>

      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
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
