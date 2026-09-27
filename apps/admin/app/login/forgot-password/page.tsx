'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AdminAuthLayout } from '@/components/AdminAuthLayout';
import { authInputClass, authInputErrorClass, authSubmitButtonClass } from '@/components/admin-auth-styles';
import { ButtonSpinner } from '@/components/ButtonSpinner';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FormField } from '@/components/FormField';

// Mirrors apps/web/app/forgot-password/page.tsx — same /api/auth/forgot-password endpoint (AC-6),
// which is role-agnostic, so staff accounts reset exactly like customers do. Resetting only
// changes the password: admin logins still go through mandatory TOTP afterwards (AC-5).
const schema = z.object({ email: z.string().email('email must be an email') });
type FormValues = z.infer<typeof schema>;

export default function AdminForgotPasswordPage() {
  const router = useRouter();
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
      // AC-6: always 200 whether or not the email exists — no enumeration.
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(values) });
      router.push(`/login/reset-password?email=${encodeURIComponent(values.email)}&requested=1`);
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
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  return (
    <AdminAuthLayout>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gold-600">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to sign in
      </Link>

      <h1 className="mt-5 font-display text-[26px] font-bold tracking-tight text-navy-800">Reset your password</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-gray-500">
        Enter your account email and, if it&apos;s registered, we&apos;ll send a 4-digit code to reset your password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" className={errors.email ? authInputErrorClass : authInputClass} {...register('email')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={authSubmitButtonClass}>
          {isSubmitting ? <ButtonSpinner label="Sending…" /> : 'Send reset code'}
        </button>
      </form>
    </AdminAuthLayout>
  );
}
