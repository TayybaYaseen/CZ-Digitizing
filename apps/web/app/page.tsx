import Link from 'next/link';
import { checkHealth } from '@/lib/api-client';

export default async function HomePage() {
  const health = await checkHealth().catch(() => null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">CZ Digitizing</h1>
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
      <p className="text-sm">
        API health:{' '}
        {health ? (
          <span className="text-green-600">{health.status} ({health.timestamp})</span>
        ) : (
          <span className="text-red-600">unreachable — is apps/api running?</span>
        )}
      </p>
    </div>
  );
}
