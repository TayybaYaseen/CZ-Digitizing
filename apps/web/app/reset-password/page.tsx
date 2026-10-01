'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

// Mirrors apps/api/src/auth/dto/reset-password.dto.ts.
const schema = z.object({
  email: z.string().email('validation.email'),
  code: z.string().length(4, 'validation.code4Digits'),
  newPassword: z.string().min(8, 'validation.passwordMin8').max(72, 'validation.passwordMax72'),
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
  const { t } = useLocale();
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
        setApiError(clientError('errors.generic'));
      }
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-[26px] font-bold tracking-tight text-brand-navy">{t('auth.resetTitle')}</h1>

      {searchParams.get('requested') && (
        <div className="mt-4">
          <SuccessBanner message={t('auth.resetCodeSent')} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        <input type="hidden" {...register('email')} />

        <FormField label={t('auth.resetCode')} htmlFor="code" error={errors.code}>
          <input id="code" type="text" inputMode="numeric" maxLength={4} className={inputClass} {...register('code')} />
        </FormField>

        <FormField label={t('auth.newPassword')} htmlFor="newPassword" error={errors.newPassword}>
          <input id="newPassword" type="password" className={inputClass} {...register('newPassword')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? t('auth.resetting') : t('auth.resetTitle')}
        </button>
      </form>
    </AuthLayout>
  );
}
