import { checkHealth } from '@/lib/api-client';
import { HomeGreeting } from '@/components/HomeGreeting';

export default async function HomePage() {
  const health = await checkHealth().catch(() => null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">CZ Digitizing</h1>
      <HomeGreeting />
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
