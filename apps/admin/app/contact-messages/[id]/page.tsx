'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, ContactMessageDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/ui/Card';

// One contact form submission — where a contact_message notification click lands.
export default function ContactMessageDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [message, setMessage] = useState<ContactMessageDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setMessage(await apiFetch<ContactMessageDto>(`/api/admin/contact-messages/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load contact message.', traceId: '' });
    }
  }, [accessToken, params.id]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/contact-messages" className="text-sm text-gray-500 hover:text-navy-800">
          ← All contact messages
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-navy-800">Contact message #{params.id}</h1>
      </div>

      <ErrorBanner error={error} onRetry={load} />

      {message === null && !error ? (
        <div className="h-40 animate-pulse rounded-card bg-white shadow-cz-sm" />
      ) : message === null ? null : (
        <Card>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-gray-500">From</dt>
            <dd className="font-medium text-navy-800">{message.name}</dd>
            <dt className="text-gray-500">Email</dt>
            <dd>
              <a href={`mailto:${message.email}`} className="text-navy-800 underline">
                {message.email}
              </a>
            </dd>
            <dt className="text-gray-500">Received</dt>
            <dd>{new Date(message.createdAt).toLocaleString()}</dd>
          </dl>
          <p className="mt-5 whitespace-pre-wrap border-t border-gray-100 pt-4 text-sm text-gray-700">{message.message}</p>
        </Card>
      )}
    </div>
  );
}
