'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthTokens, useAuth } from '@/lib/auth-context';
import { clearPendingTwoFactor, readPendingTwoFactor, type PendingTwoFactor } from '@/lib/pending-2fa';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';

const schema = z.object({ code: z.string().length(6, 'code must be 6 digits') });
type FormValues = z.infer<typeof schema>;

interface SetupData {
  otpauthUrl: string;
  secret: string;
}

export default function TwoFactorPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [pending, setPending] = useState<PendingTwoFactor | null | undefined>(undefined);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const stored = readPendingTwoFactor();
    setPending(stored);
    if (!stored) {
      router.replace('/login');
      return;
    }
    if (stored.setupRequired) {
      apiFetch<SetupData>('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored.pendingTwoFactorToken}` },
      })
        .then(setSetupData)
        .catch((err) => setLoadError(err instanceof ApiClientError ? err.error : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: FormValues) {
    if (!pending) return;
    setApiError(null);
    try {
      const path = pending.setupRequired ? '/api/auth/2fa/confirm' : '/api/auth/verify-2fa';
      const tokens = await apiFetch<AuthTokens>(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pending.pendingTwoFactorToken}` },
        body: JSON.stringify(values),
      });
      clearPendingTwoFactor();
      login(tokens);
      router.push('/');
    } catch (err) {
      // Covers a wrong/expired 6-digit code and an expired pending-session token alike.
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
    }
  }

  if (pending === undefined) return null; // reading sessionStorage
  if (!pending) return null; // already redirecting to /login

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Two-factor authentication</h1>

      {pending.setupRequired && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password),
            then enter the 6-digit code it generates.
          </p>
          {setupData ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-gray-700 bg-white p-4">
              <QRCodeSVG value={setupData.otpauthUrl} size={192} />
              <p className="break-all text-center text-xs text-gray-600">Can&apos;t scan? Enter manually: {setupData.secret}</p>
            </div>
          ) : (
            <ErrorBanner error={loadError} />
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label="6-digit code" htmlFor="code" error={errors.code}>
          <input id="code" type="text" inputMode="numeric" maxLength={6} className={inputClass} {...register('code')} />
        </FormField>

        <button type="submit" disabled={isSubmitting || (pending.setupRequired && !setupData)} className={submitButtonClass}>
          {isSubmitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
