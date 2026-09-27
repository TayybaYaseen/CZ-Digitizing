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
import {
  authCodeInputClass,
  authCodeInputErrorClass,
  authInputClass,
  authInputErrorClass,
  authSubmitButtonClass,
} from '@/components/admin-auth-styles';
import { ButtonSpinner } from '@/components/ButtonSpinner';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';

// Mirrors apps/web/app/reset-password/page.tsx and apps/api/src/auth/dto/reset-password.dto.ts.
const schema = z.object({
  email: z.string().email(),
  code: z.string().length(4, 'code must be 4 digits'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters').max(72),
});

type FormValues = z.infer<typeof schema>;

export default function AdminResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: searchParams.get('email') ?? '', code: '', newPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      // AC-6: revokes every existing session for this account, so the user logs in fresh
      // (password + 2FA) rather than being auto-logged-in here.
      await apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(values) });
      router.push('/login?reset=1');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
          for (const fieldError of err.error.errors) {
            setError(fieldError.field as keyof FormValues, { message: fieldError.message });
          }
        } else {
          // INVALID_OR_EXPIRED_CODE — same message whether the code is wrong or the email doesn't
          // exist (AC-6 no-enumeration guarantee).
          setApiError(err.error);
        }
      } else {
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  const email = searchParams.get('email');

  return (
    <AdminAuthLayout>
      <h1 className="font-display text-[26px] font-bold tracking-tight text-navy-800">Set a new password</h1>
      {email && <p className="mt-2 text-[14.5px] text-gray-500">For {email}</p>}

      {searchParams.get('requested') && (
        <div className="mt-4">
          <SuccessBanner message="If that email is registered, a reset code was sent — it expires in 10 minutes." />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        {email ? (
          <input type="hidden" {...register('email')} />
        ) : (
          <FormField label="Email" htmlFor="email" error={errors.email}>
            <input id="email" type="email" className={errors.email ? authInputErrorClass : authInputClass} {...register('email')} />
          </FormField>
        )}

        <FormField label="Reset code" htmlFor="code" error={errors.code}>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            className={errors.code ? authCodeInputErrorClass : authCodeInputClass}
            {...register('code')}
          />
        </FormField>

        <FormField label="New password" htmlFor="newPassword" error={errors.newPassword}>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            className={errors.newPassword ? authInputErrorClass : authInputClass}
            {...register('newPassword')}
          />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
          {isSubmitting ? <ButtonSpinner label="Resetting…" /> : 'Reset password'}
        </button>

        <p className="text-center text-[13px] text-gray-500">
          Didn&apos;t get a code?{' '}
          <Link href="/login/forgot-password" className="font-medium text-navy-800 hover:text-gold-600 hover:underline">
            Send another
          </Link>
        </p>
      </form>
    </AdminAuthLayout>
  );
}
