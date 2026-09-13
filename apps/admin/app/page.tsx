import Link from 'next/link';
import { checkHealth } from '@/lib/api-client';
import { AdminAuthLayout } from '@/components/AdminAuthLayout';

// UI-only visual correction (2026-09-12 gap analysis): this landing page previously rendered as a
// bare "Admin Portal" heading + a login link + a health-check line inside the app's default
// authenticated shell — the exact "plain Admin Portal prototype" the gap analysis flagged. Same
// content and the same health check, now presented inside the branded AdminAuthLayout instead.
export default async function AdminHomePage() {
  const health = await checkHealth().catch(() => null);

  return (
    <AdminAuthLayout>
      <div className="space-y-1">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-navy-800">Admin Portal</h1>
        <p className="text-[14.5px] text-gray-500">
          <Link href="/login" className="font-medium text-navy-800 hover:text-gold-600 hover:underline">
            Log in
          </Link>{' '}
          (mandatory 2FA) to manage freelancer/limited-admin accounts and platform settings.
        </p>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        API health:{' '}
        {health ? (
          <span className="font-medium text-status-greenFg">
            {health.status} ({health.timestamp})
          </span>
        ) : (
          <span className="font-medium text-status-redFg">unreachable — is apps/api running?</span>
        )}
      </p>
    </AdminAuthLayout>
  );
}
