'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

// docs/specs/2026-08-28-05-private-file-management.md §5 — /account/purchased-designs (AC-8).
// GET /api/orders/:id/files (A-007) is real and gated on order status per A-013's AC-6, but it's
// keyed by a single order id — there is no "all my authorized files across every order" endpoint,
// only per-order listing. /account/orders (A-013) is the real entry point: each order there links
// to /order-confirmation/:id, which itself links to this page's natural next step once files are
// released. Kept here as a simple redirect-style pointer rather than re-implementing an
// order-selector, since /account/orders already is that selector.
export default function PurchasedDesignsPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace('/login');
  }, [isReady, user, router]);

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Purchased Designs</h1>
        <p className="mt-1 text-sm text-gray-600">Your bought design files, ready to download after payment is confirmed.</p>
      </div>

      <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
        <p>View your files from each order&apos;s confirmation page.</p>
        <Link href="/account/orders" className="mt-2 inline-block text-brand-navy underline">
          Go to Order History
        </Link>
      </div>
    </div>
  );
}
