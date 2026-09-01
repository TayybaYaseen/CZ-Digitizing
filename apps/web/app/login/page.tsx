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
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';

const schema = z.object({
  email: z.string().email('email must be an email'),
  password: z.string().min(1, 'password is required'),
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
      const result = await apiFetch<LoginResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      if ('pendingTwoFactorToken' in result) {
        // Only reachable if this email belongs to an admin account (AC-5 always requires 2FA) —
        // the customer site has no 2FA UI, so send them to the right place instead of failing silently.
        setApiError({
          code: 'FORBIDDEN',
          message: 'This account requires the Admin portal to log in.',
          traceId: '',
        });
        return;
      }

      login(result);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'NEW_DEVICE_VERIFICATION_REQUIRED') {
          router.push(`/verify-device?email=${encodeURIComponent(getValues('email'))}`);
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
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Log in</h1>

      {searchParams.get('registered') && (
        <SuccessBanner message="Account created — check your email to verify it, then log in." />
      )}
      {searchParams.get('reset') && <SuccessBanner message="Password reset — log in with your new password." />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner error={apiError} />

        <FormField label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" className={inputClass} {...register('email')} />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password}>
          <input id="password" type="password" className={inputClass} {...register('password')} />
        </FormField>

        <div className="text-right text-sm">
          <Link href="/forgot-password" className="text-gray-600 underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="text-sm text-gray-600">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-gray-900 underline">
          Register
        </Link>
      </p>
    </div>
  );
}
