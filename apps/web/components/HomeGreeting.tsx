'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

// Split out of app/page.tsx (a server component) since this needs localStorage-backed auth
// state. Gives visible confirmation that login actually took effect — previously the landing
// page looked identical whether signed in or not, which read as "did that even work?".
export function HomeGreeting() {
  const { user, isReady } = useAuth();

  if (!isReady) return null; // still checking localStorage

  if (user) {
    return (
      <p className="text-gray-600">
        Welcome back, {user.displayName ?? user.email}.{' '}
        <Link href="/account" className="underline">
          My Account
        </Link>
      </p>
    );
  }

  return (
    <p className="text-gray-600">
      <Link href="/login" className="underline">
        Log in
      </Link>{' '}
      or{' '}
      <Link href="/register" className="underline">
        register
      </Link>
      . Design catalog, cart, checkout, and account pages land here as their specs are built.
    </p>
  );
}
