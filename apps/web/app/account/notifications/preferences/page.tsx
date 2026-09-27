'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

// AC-5 — target of the one-click unsubscribe link in notification emails. Public page: no login
// required, the token in the URL is the authorization (mirrors the backend's @Public() route).
// NOT the notification preference center (AC-9) despite the similar URL — that's the dedicated
// /account/notifications/settings page this one links to below. Kept at this exact path since
// notification-email.service.ts already points every sent unsubscribe link here.
export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [result, setResult] = useState<{ notificationType: string } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError({ code: 'VALIDATION_ERROR', message: 'Missing unsubscribe token.', traceId: '' });
      setLoading(false);
      return;
    }
    apiFetch<{ notificationType: string }>(`/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((data) => setResult(data))
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Something went wrong.', traceId: '' }),
      )
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Email preferences</h1>
      {loading && <p className="text-sm text-gray-500">Updating your preferences…</p>}
      {!loading && result && (
        <>
          <SuccessBanner message={`You've been unsubscribed from "${humanize(result.notificationType)}" emails.`} />
          <p className="text-sm text-gray-500">
            You can re-enable them any time from your{' '}
            <Link href="/account/notifications/settings" className="underline">
              notification preferences
            </Link>
            .
          </p>
        </>
      )}
      {!loading && error && <ErrorBanner error={error} />}
    </div>
  );
}
