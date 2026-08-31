import { checkHealth } from '@/lib/api-client';

export default async function HomePage() {
  const health = await checkHealth().catch(() => null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">CZ Digitizing — public web (skeleton)</h1>
      <p className="text-gray-600">
        Design catalog, cart, checkout, and account pages land here as their specs are built.
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
