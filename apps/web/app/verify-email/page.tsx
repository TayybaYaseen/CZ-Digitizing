'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiClientError, apiFetch } from '@/lib/api-client';

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
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiClientError ? err.error.message : 'Verification failed — the link may be expired.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      {status === 'verifying' && <p className="text-sm text-gray-600">Verifying your email…</p>}
      {status === 'success' && (
        <>
          <h1 className="text-2xl font-bold">Email verified</h1>
          <Link href="/login" className="font-medium text-gray-900 underline">
            Log in
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <h1 className="text-2xl font-bold">Verification failed</h1>
          <p className="text-sm text-red-600">{message}</p>
        </>
      )}
    </div>
  );
}
