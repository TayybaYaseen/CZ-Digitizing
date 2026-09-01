import Link from 'next/link';
import { checkHealth } from '@/lib/api-client';

export default async function AdminHomePage() {
  const health = await checkHealth().catch(() => null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Portal</h1>
      <p className="text-gray-400">
        <Link href="/login" className="underline">
          Log in
        </Link>{' '}
        (mandatory 2FA) to manage freelancer/limited-admin accounts and platform settings.
      </p>
      <p className="text-sm">
        API health:{' '}
        {health ? (
          <span className="text-green-400">{health.status} ({health.timestamp})</span>
        ) : (
          <span className="text-red-400">unreachable — is apps/api running?</span>
        )}
      </p>
    </div>
  );
}
