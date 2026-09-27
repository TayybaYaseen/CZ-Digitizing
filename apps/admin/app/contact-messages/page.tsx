'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, ContactMessageDto } from '@czd/shared-types';
import { ApiClientError, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

const PAGE_SIZE = 20;

// SRS §15 (Contact Us, aspect A-010) — inbox of public contact form submissions, newest first.
// contact_message notifications link to /contact-messages/[id].
export default function ContactMessagesPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [messages, setMessages] = useState<ContactMessageDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listError, setListError] = useState<ApiError | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      if (!accessToken) return;
      setListError(null);
      try {
        const { data, meta } = await apiFetchWithMeta<ContactMessageDto[]>(
          `/api/admin/contact-messages?page=${targetPage}&pageSize=${PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        setMessages(data);
        setTotal(meta?.total ?? data.length);
        setPage(targetPage);
      } catch (err) {
        setListError(
          err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load contact messages.', traceId: '' },
        );
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) {
      router.replace('/login');
      return;
    }
    load(1);
  }, [isReady, user, load, router]);

  if (!isReady || !user) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Contact Messages</h1>
        <p className="mt-1 text-sm text-gray-500">Submissions from the public Contact Us form.</p>
      </div>

      <ErrorBanner error={listError} onRetry={() => load(page)} />

      {messages === null && !listError ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-card bg-white shadow-cz-sm" />
          ))}
        </ul>
      ) : messages === null ? null : messages.length === 0 ? (
        <p className="rounded-card border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
          No contact messages yet.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 rounded-card border border-gray-200 bg-white shadow-cz-sm">
            {messages.map((m) => (
              <li key={m.id}>
                <Link href={`/contact-messages/${m.id}`} className="block px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="truncate text-sm font-medium text-navy-800">
                      {m.name} <span className="font-normal text-gray-500">&lt;{m.email}&gt;</span>
                    </p>
                    <p className="flex-shrink-0 text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{m.message}</p>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="rounded-field border border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => load(page + 1)}
                className="rounded-field border border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
