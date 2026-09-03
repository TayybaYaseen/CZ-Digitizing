'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';

// Mirrors docs/CZ Digitizing Admin Panel.html's decoded `Placeholder` component — used there for
// exactly the same reason: a nav destination whose owning aspect isn't built yet. Real content
// ships once its aspect (named in `blockedOn`) is Completed per docs/specs/SPEC_INDEX.md.
export function ComingSoon({ title, blockedOn }: { title: string; blockedOn: string }) {
  const router = useRouter();
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace('/login');
  }, [isReady, user, router]);

  if (!isReady || !user) return null;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-bold text-navy-800">{title}</h1>
      <Card>
        <p className="text-sm text-gray-500">
          This module isn&apos;t built yet — it depends on <strong className="text-navy-800">{blockedOn}</strong>, which is
          still in progress. Check back once that aspect ships.
        </p>
      </Card>
    </div>
  );
}
