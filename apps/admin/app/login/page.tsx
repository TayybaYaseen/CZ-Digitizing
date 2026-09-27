'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AdminAuthLayout } from '@/components/AdminAuthLayout';
import { authInputClass, authInputErrorClass, authSubmitButtonClass } from '@/components/admin-auth-styles';
import { ButtonSpinner } from '@/components/ButtonSpinner';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { PENDING_2FA_STORAGE_KEY } from '@/lib/pending-2fa';

const schema = z.object({
  email: z.string().email('email must be an email'),
  password: z.string().min(1, 'password is required'),
});

type FormValues = z.infer<typeof schema>;

// Admin login (AC-5) never returns tokens directly — always a partial session pending 2FA,
// either "confirm setup" (first time) or "verify" (already enrolled).
interface PendingTwoFactorResult {
  pendingTwoFactorToken: string;
  setupRequired: boolean;
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      const result = await apiFetch<PendingTwoFactorResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      // Short-lived (5 min) partial-session token — sessionStorage keeps it out of the URL/history.
      window.sessionStorage.setItem(PENDING_2FA_STORAGE_KEY, JSON.stringify(result));
      router.push('/login/2fa');
    } catch (err) {
      if (err instanceof ApiClientError) {
        // A freelancer/moderator account (RolesGuard also admits these to the admin portal) has no
        // mandatory TOTP — an untrusted browser gets this instead of a pendingTwoFactorToken.
        if (err.error.code === 'NEW_DEVICE_VERIFICATION_REQUIRED') {
          router.push(`/login/verify-device?email=${encodeURIComponent(values.email)}`);
          return;
        }
        if (err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
          for (const fieldError of err.error.errors) {
            setError(fieldError.field as keyof FormValues, { message: fieldError.message });
          }
        } else {
          setApiError(err.error);
        }
      } else {
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  return (
    <AdminAuthLayout>
      <div className="space-y-1">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-navy-800">Admin login</h1>
        <p className="text-[14.5px] text-gray-500">Sign in to the CZ Digitizing operations console</p>
      </div>

      {searchParams.get('reset') && (
        <div className="mt-6">
          <SuccessBanner message="Password reset — log in with your new password." />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" className={errors.email ? authInputErrorClass : authInputClass} {...register('email')} />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput id="password" className={errors.password ? authInputErrorClass : authInputClass} {...register('password')} />
        </FormField>

        <div className="-mt-2 flex justify-end">
          <Link href="/login/forgot-password" className="text-[13px] font-medium text-navy-800 hover:text-gold-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
          {isSubmitting ? <ButtonSpinner label="Continuing…" /> : 'Continue'}
        </button>
      </form>
    </AdminAuthLayout>
  );
}
