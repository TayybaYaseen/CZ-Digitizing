'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthTokens, useAuth } from '@/lib/auth-context';
import { safeNextPath } from '@/lib/safe-redirect';
import { AuthLayout } from '@/components/AuthLayout';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { PasswordInput } from '@/components/PasswordInput';
import { useLocale } from '@/lib/locale-context';
import { clientError } from '@/i18n/api-errors';

const schema = z.object({
  // Messages are translation keys, resolved by FormField (i18n A-021).
  email: z.string().email('validation.email'),
  password: z.string().min(1, 'validation.required'),
});

type FormValues = z.infer<typeof schema>;

// A 200 from /api/auth/login is always one of these two shapes — errors (wrong credentials,
// new-device, rate limit) always arrive via a thrown ApiClientError instead, never as a 200.
type LoginResult = AuthTokens | { pendingTwoFactorToken: string; setupRequired: boolean };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { t, rich } = useLocale();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const next = searchParams.get('next');

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      const result = await apiFetch<LoginResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      if ('pendingTwoFactorToken' in result) {
        // Only reachable if this email belongs to an admin account (AC-5 always requires 2FA) —
        // the customer site has no 2FA UI, so send them to the right place instead of failing silently.
        setApiError(clientError('errors.adminPortalRequired', 'FORBIDDEN'));
        return;
      }

      login(result);
      router.push(safeNextPath(next));
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'NEW_DEVICE_VERIFICATION_REQUIRED') {
          const params = new URLSearchParams({ email: getValues('email') });
          if (next) params.set('next', next);
          router.push(`/verify-device?${params.toString()}`);
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
        setApiError(clientError('errors.generic'));
      }
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-1">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-brand-navy">{t('auth.loginTitle')}</h1>
        <p className="text-[14.5px] text-gray-500">{t('auth.loginSubtitle')}</p>
      </div>

      {searchParams.get('registered') && (
        <div className="mt-6">
          <SuccessBanner message={t('auth.accountCreated')} />
        </div>
      )}
      {searchParams.get('reset') && (
        <div className="mt-6">
          <SuccessBanner message={t('auth.passwordResetDone')} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label={t('auth.emailAddress')} htmlFor="email" error={errors.email}>
          <input id="email" type="email" placeholder={t('auth.emailPlaceholder')} className={inputClass} {...register('email')} />
        </FormField>

        <FormField label={t('auth.password')} htmlFor="password" error={errors.password}>
          <PasswordInput id="password" placeholder="••••••••" {...register('password')} />
        </FormField>

        <div className="text-end text-sm">
          <Link href="/forgot-password" className="font-medium text-brand-navy hover:text-brand-gold hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>

      <p className="mt-8 text-center text-[13.5px] text-slate-600">
        {rich('auth.noAccount', {
          link: (chunk) => (
            <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-medium text-brand-navy hover:text-brand-gold hover:underline">
              {chunk}
            </Link>
          ),
        })}
      </p>
    </AuthLayout>
  );
}
