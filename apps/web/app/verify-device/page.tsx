'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { AuthTokens, useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';

// Mirrors apps/api/src/auth/dto/verify-new-device.dto.ts.
const schema = z.object({
  email: z.string().email(),
  code: z.string().length(4, 'code must be 4 digits'),
});

type FormValues = z.infer<typeof schema>;

export default function VerifyDevicePage() {
  return (
    <Suspense>
      <VerifyDeviceForm />
    </Suspense>
  );
}

function VerifyDeviceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: searchParams.get('email') ?? '', code: '' },
  });

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      const tokens = await apiFetch<AuthTokens>('/api/auth/verify-new-device', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      login(tokens);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
          for (const fieldError of err.error.errors) {
            setError(fieldError.field as keyof FormValues, { message: fieldError.message });
          }
        } else {
          // Covers INVALID_OR_EXPIRED_CODE and RATE_LIMITED (AC-4) — both shown as a top banner.
          setApiError(err.error);
        }
      } else {
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Verify this device</h1>
      <p className="text-sm text-gray-600">
        We emailed a 4-digit code to confirm it&apos;s really you logging in from a new device.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner error={apiError} />

        <input type="hidden" {...register('email')} />

        <FormField label="Verification code" htmlFor="code" error={errors.code}>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={4}
            className={inputClass}
            {...register('code')}
          />
        </FormField>

        <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
          {isSubmitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
