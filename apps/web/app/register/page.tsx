'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { useLocale } from '@/lib/locale-context';
import { clientError } from '@/i18n/api-errors';

// Mirrors apps/api/src/auth/dto/register.dto.ts exactly (AC-1: bcrypt input limit is 72 bytes).
// Messages are translation keys, resolved by FormField (i18n A-021).
const schema = z.object({
  email: z.string().email('validation.email'),
  password: z
    .string()
    .min(8, 'validation.passwordMin8')
    .max(72, 'validation.passwordMax72'),
  displayName: z.string().max(255).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const { t, rich } = useLocale();
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
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...values, displayName: values.displayName || undefined }),
      });
      const params = new URLSearchParams({ registered: '1' });
      if (next) params.set('next', next);
      router.push(`/login?${params.toString()}`);
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
      <div className="space-y-1">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-brand-navy">{t('auth.registerTitle')}</h1>
        <p className="text-[14.5px] text-gray-500">{t('auth.registerSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label={t('common.email')} htmlFor="email" error={errors.email}>
          <input id="email" type="email" className={inputClass} {...register('email')} />
        </FormField>

        <FormField label={t('auth.password')} htmlFor="password" error={errors.password}>
          <PasswordInput id="password" {...register('password')} />
        </FormField>

        <FormField label={t('auth.displayNameOptional')} htmlFor="displayName" error={errors.displayName}>
          <input id="displayName" type="text" className={inputClass} {...register('displayName')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')}
        </button>
      </form>

      <p className="mt-8 text-center text-[13.5px] text-slate-600">
        {rich('auth.haveAccount', {
          link: (chunk) => (
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-brand-navy hover:text-brand-gold hover:underline">
              {chunk}
            </Link>
          ),
        })}
      </p>
    </AuthLayout>
  );
}
