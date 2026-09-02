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

const schema = z.object({ email: z.string().email('email must be an email') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
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
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  return (
    <AuthLayout>
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-700"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to sign in
      </Link>

      <h1 className="mt-5 text-[24px] font-semibold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">
        Enter your account email and, if it&apos;s registered, we&apos;ll send a 4-digit code to reset your
        password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label="Email address" htmlFor="email" error={errors.email}>
          <input id="email" type="email" placeholder="you@company.com" className={inputClass} {...register('email')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? 'Sending…' : 'Send reset code'}
        </button>
      </form>
    </AuthLayout>
  );
}
