'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthTokens, useAuth } from '@/lib/auth-context';
import { safeNextPath } from '@/lib/safe-redirect';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';

// Mirrors apps/api/src/auth/dto/verify-new-device.dto.ts.
const schema = z.object({
  email: z.string().email(),
  code: z.string().length(4, 'code must be 4 digits'),
});

type FormValues = z.infer<typeof schema>;

// A code was emailed moments before this page opened, so "Resend" starts on cooldown too. The API
// also rate-limits POST /api/auth/resend-device-code (3 per 15 min); this just keeps the button
// from being hammered.
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyDevicePage() {
  return (
    <Suspense>
      <VerifyDeviceForm />
    </Suspense>
  );
}

function VerifyDeviceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const email = searchParams.get('email') ?? '';
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email, code: '' },
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function onResend() {
    setApiError(null);
    setResent(false);
    setResending(true);
    try {
      await apiFetch('/api/auth/resend-device-code', {
        method: 'POST',
        body: JSON.stringify({ email: getValues('email') }),
      });
      resetField('code'); // the previous code no longer works
      setResent(true);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setApiError(
        err instanceof ApiClientError
          ? err.error
          : { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' },
      );
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      const tokens = await apiFetch<AuthTokens>('/api/auth/verify-new-device', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      login(tokens);
      router.push(safeNextPath(searchParams.get('next')));
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
          for (const fieldError of err.error.errors) {
            setError(fieldError.field as keyof FormValues, { message: fieldError.message });
          }
        } else {
          // Covers INVALID_OR_EXPIRED_CODE and RATE_LIMITED (AC-4) — both shown as a top banner.
          setApiError(err.error);
        }
      } else {
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-[26px] font-bold tracking-tight text-brand-navy">Verify this device</h1>
      <p className="mt-2 text-[14.5px] text-gray-500">
        {email ? (
          <>
            We emailed a 4-digit code to <span className="break-words font-semibold text-brand-navy">{email}</span> to confirm
            it&apos;s really you logging in from a new device.
          </>
        ) : (
          <>We emailed a 4-digit code to confirm it&apos;s really you logging in from a new device.</>
        )}
      </p>
      {email && (
        <p className="mt-1.5 text-[13px] text-gray-500">
          Not you?{' '}
          <Link href="/login" className="font-medium text-brand-navy underline-offset-2 hover:text-brand-gold hover:underline">
            Sign in with a different email
          </Link>
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
        <ErrorBanner error={apiError} />
        {resent && !apiError && (
          <SuccessBanner message={`We've sent a new code to ${email || 'your email'}. It expires in 15 minutes.`} />
        )}

        <input type="hidden" {...register('email')} />

        <FormField label="Verification code" htmlFor="code" error={errors.code}>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={4}
            className={inputClass}
            {...register('code')}
          />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? 'Verifying…' : 'Verify'}
        </button>

        <p className="text-center text-[13.5px] text-gray-500">
          Didn&apos;t get the code?{' '}
          {resendCooldown > 0 ? (
            <span>Resend in {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="font-medium text-brand-navy underline-offset-2 hover:text-brand-gold hover:underline disabled:opacity-60"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}
