'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

const schema = z.object({ email: z.string().email('validation.email') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      // AC-6: this call always succeeds (200) whether or not the email exists — no enumeration.
      // So a 200 here means "request accepted," not "email confirmed to exist."
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(values) });
      router.push(`/reset-password?email=${encodeURIComponent(getValues('email'))}&requested=1`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
          for (const fieldError of err.error.errors) {
            setError(fieldError.field as keyof FormValues, { message: fieldError.message });
          }
        } else {
          setApiError(err.error);
        }
      } else {
        setApiError(clientError('errors.generic'));
      }
    }
  }

  return (
    <AuthLayout>
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-brand-gold"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="rtl:-scale-x-100">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('auth.backToSignIn')}
      </Link>

      <h1 className="mt-5 font-display text-[26px] font-bold tracking-tight text-brand-navy">{t('auth.forgotTitle')}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-gray-500">{t('auth.forgotSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label={t('auth.emailAddress')} htmlFor="email" error={errors.email}>
          <input id="email" type="email" placeholder={t('auth.emailPlaceholder')} className={inputClass} {...register('email')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? t('common.sending') : t('auth.sendResetCode')}
        </button>
      </form>
    </AuthLayout>
  );
}
