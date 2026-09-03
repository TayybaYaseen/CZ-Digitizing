'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

// docs/specs/2026-08-28-05-private-file-management.md §5 — /account/purchased-designs (AC-8).
// There is genuinely nothing to list yet: the backend (GET /api/orders/:id/files) is real but
// gated behind an order id, and no order-listing endpoint exists because Orders (A-013) hasn't
// shipped — still Blocked per docs/specs/SPEC_INDEX.md. Rather than call the download API with a
// fabricated order id (which would just surface a confusing error), this page states the honest
// current state and links back to the catalog. It becomes a real per-order file list the moment
// A-013 ships a "my orders" endpoint to enumerate from.
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
        <p>Purchases aren&apos;t available yet — checkout hasn&apos;t launched.</p>
        <Link href="/designs" className="mt-2 inline-block text-brand-navy underline">
          Browse designs
        </Link>
      </div>
    </div>
  );
}
