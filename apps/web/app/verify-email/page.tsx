'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { clientError } from '@/i18n/api-errors';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useLocale } from '@/lib/locale-context';

// Not in spec §5's route list, but AC-1 requires email verification, and the link
// AuthService.register() emails (apps/api/src/auth/auth.service.ts) points here —
// GET /api/auth/verify-email?token=... has nowhere else to land without this page.
type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { t, errorMessage } = useLocale();
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError(clientError('auth.missingVerificationToken'));
      return;
    }
    apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(err instanceof ApiClientError ? err.error : clientError('auth.verificationFailedExpired'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      {status === 'verifying' && <p className="text-sm text-gray-600">{t('auth.verifyingEmail')}</p>}
      {status === 'success' && (
        <>
          <h1 className="text-2xl font-bold">{t('auth.emailVerified')}</h1>
          <Link href="/login" className="font-medium text-gray-900 underline">
            {t('nav.login')}
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <h1 className="text-2xl font-bold">{t('auth.verificationFailed')}</h1>
          <p className="text-sm text-red-600">{error ? errorMessage(error) : ''}</p>
        </>
      )}
    </div>
  );
}
