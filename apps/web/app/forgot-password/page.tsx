'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
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
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Forgot password</h1>
      <p className="text-sm text-gray-600">
        Enter your account email and, if it&apos;s registered, we&apos;ll send a 4-digit code to
        reset your password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" className={inputClass} {...register('email')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? 'Sending…' : 'Send reset code'}
        </button>
      </form>
    </div>
  );
}
