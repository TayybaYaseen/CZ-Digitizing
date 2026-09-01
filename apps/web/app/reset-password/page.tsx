'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';

// Mirrors apps/api/src/auth/dto/reset-password.dto.ts.
const schema = z.object({
  email: z.string().email(),
  code: z.string().length(4, 'code must be 4 digits'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters').max(72),
});

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
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
      // AC-6: revokes every existing session for this account — the user must log in fresh
      // afterward, so redirect to /login rather than trying to auto-log-in here.
      await apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(values) });
      router.push('/login?reset=1');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
          for (const fieldError of err.error.errors) {
            setError(fieldError.field as keyof FormValues, { message: fieldError.message });
          }
        } else {
          // Covers INVALID_OR_EXPIRED_CODE — deliberately the same message whether the code is
          // wrong or the email doesn't exist (AC-6 no-enumeration guarantee).
          setApiError(err.error);
        }
      } else {
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Reset password</h1>

      {searchParams.get('requested') && (
        <SuccessBanner message="If that email is registered, a reset code was sent — it expires in 10 minutes." />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner error={apiError} />

        <input type="hidden" {...register('email')} />

        <FormField label="Reset code" htmlFor="code" error={errors.code}>
          <input id="code" type="text" inputMode="numeric" maxLength={4} className={inputClass} {...register('code')} />
        </FormField>

        <FormField label="New password" htmlFor="newPassword" error={errors.newPassword}>
          <input id="newPassword" type="password" className={inputClass} {...register('newPassword')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
