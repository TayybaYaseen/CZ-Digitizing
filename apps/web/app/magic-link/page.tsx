'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthTokens, useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

// AC-12 — lands here from the login link MagicLinkService emails
// (apps/api/src/auth/services/magic-link.service.ts): GET /api/auth/magic-link/verify?token=...
// has nowhere else to land without this page. Not in spec §5's route list for the same reason
// /verify-email isn't — the spec's route inventory predates this page's need.
type LoginResult = AuthTokens | { pendingTwoFactorToken: string; setupRequired: boolean };

// Payload is read for its `email` claim only, to prefill /verify-device on a NEW_DEVICE_VERIFICATION_REQUIRED
// outcome — never trusted as proof of anything; the actual verification happens server-side.
function readEmailUnverified(token: string): string | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

export default function MagicLinkPage() {
  return (
    <Suspense>
      <MagicLinkContent />
    </Suspense>
  );
}

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError({ code: 'VALIDATION_ERROR', message: 'Missing login link token.', traceId: '' });
      return;
    }

    apiFetch<LoginResult>(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`)
      .then((result) => {
        if ('pendingTwoFactorToken' in result) {
          // Only reachable if this email belongs to an admin account — mirrors login page's
          // handling: the customer site has no 2FA UI.
          setError({ code: 'FORBIDDEN', message: 'This account requires the Admin portal to log in.', traceId: '' });
          return;
        }
        login(result);
        router.push('/');
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.error.code === 'NEW_DEVICE_VERIFICATION_REQUIRED') {
          const email = readEmailUnverified(token);
          router.push(`/verify-device${email ? `?email=${encodeURIComponent(email)}` : ''}`);
          return;
        }
        setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Something went wrong.', traceId: '' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      {!error && <p className="text-sm text-gray-600">Logging you in…</p>}
      {error && (
        <>
          <h1 className="text-2xl font-bold">Couldn&apos;t log you in</h1>
          <ErrorBanner error={error} />
        </>
      )}
    </div>
  );
}
