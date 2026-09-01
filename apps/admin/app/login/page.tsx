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
      const result = await apiFetch<PendingTwoFactorResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      // Short-lived (5 min) partial-session token — sessionStorage keeps it out of the URL/history.
      window.sessionStorage.setItem(PENDING_2FA_STORAGE_KEY, JSON.stringify(result));
      router.push('/login/2fa');
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
      <h1 className="text-2xl font-bold">Admin login</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" className={inputClass} {...register('email')} />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password}>
          <input id="password" type="password" className={inputClass} {...register('password')} />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? 'Continuing…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
