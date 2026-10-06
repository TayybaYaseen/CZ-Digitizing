'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ApiError, CustomRequestDto, CustomRequestFileDto, CustomRequestMessageDto, CustomRequestSummaryDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { API_URL } from '@/lib/api-url';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

// Status labels live under `customRequestStatus.<status>` in the locale files (i18n A-021).

// docs/specs/2026-08-28-12-custom-design-requests.md §5 — /account/custom-requests. Follows the
// same "list with inline expand" convention as /account/quotes and admin's /quotes page rather
// than a separate /:id route, for consistency with the rest of this codebase.
export default function MyCustomRequestsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { t, tOr, formatDate } = useLocale();
  const [items, setItems] = useState<CustomRequestSummaryDto[] | null>(null);
  const [expanded, setExpanded] = useState<CustomRequestDto | null>(null);
  const [messages, setMessages] = useState<CustomRequestMessageDto[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  const load = useCallback(async () => {
    if (!user || !accessToken) return;
    try {
      const list = await apiFetch<CustomRequestSummaryDto[]>('/api/custom-requests/user/history', { headers: { Authorization: `Bearer ${accessToken}` } });
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.loadCustomRequestsFailed'));
    }
  }, [user, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function expand(id: string) {
    if (!accessToken) return;
    setError(null);
    try {
      const detail = await apiFetch<CustomRequestDto>(`/api/custom-requests/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setExpanded(detail);
      const list = await apiFetch<CustomRequestMessageDto[]>(`/api/custom-requests/${id}/messages`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setMessages(list);
      connectSocket(id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.loadRequestFailed'));
    }
  }

  // AC-8 — live message delivery + typing indicator over the custom-requests WebSocket gateway.
  function connectSocket(customRequestId: string) {
    socketRef.current?.disconnect();
    const socket = io(`${API_URL}/custom-requests`, { auth: { token: accessToken } });
    socket.on('connect', () => socket.emit('join', { customRequestId }));
    socket.on('message', (msg: CustomRequestMessageDto) => setMessages((prev) => [...prev, msg]));
    socket.on('typing', ({ isTyping }: { isTyping: boolean }) => setTypingUser(isTyping ? 'admin' : null));
    socketRef.current = socket;
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  function onTyping(value: string) {
    setChatInput(value);
    if (expanded) socketRef.current?.emit('typing', { customRequestId: expanded.id, isTyping: value.length > 0 });
  }

  function sendMessage() {
    if (!expanded || !chatInput.trim()) return;
    socketRef.current?.emit('message', { customRequestId: expanded.id, message: chatInput });
    setChatInput('');
  }

  // Bank transfer is the only payment method: approving creates the order to pay.
  async function approve() {
    if (!expanded || !accessToken) return;
    setError(null);
    try {
      const order = await apiFetch<{ id: string }>(`/api/custom-requests/${expanded.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ paymentMethod: 'bank_transfer' }),
      });
      // Straight to the bank details + receipt upload for the new order.
      router.push(`/checkout/bank-transfer/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.approveQuoteFailed'));
    }
  }

  // Note: this repo has no GET route that streams a file for a signed download token yet, for any
  // file type (see private-files.spec.ts's own "never streams a file — it always 422s until Orders
  // exists" test title) — so this only requests/confirms authorization, same honest-gap posture as
  // every other private-file consumer in this codebase, rather than inventing a route that isn't
  // there.
  async function download(file: CustomRequestFileDto) {
    if (!expanded || !accessToken) return;
    try {
      await apiFetch<{ downloadUrl: string; expiresAt: string }>(`/api/custom-requests/${expanded.id}/files/${file.id}/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.downloadFailed'));
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('customRequest.myTitle')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('customRequest.mySubtitle')}</p>
      </div>

      <ErrorBanner error={error} />

      {items === null ? (
        <p className="text-center text-sm text-gray-500">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>{t('customRequest.none')}</p>
          <a href="/custom-request" className="mt-2 inline-block text-brand-navy underline">
            {t('customRequest.submitOne')}
          </a>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {items.map((r) => (
            <li key={r.id} className="p-4">
              <button onClick={() => expand(r.id)} className="flex w-full items-center justify-between text-start text-sm">
                <div>
                  <p className="font-medium">#{r.requestNumber}</p>
                  <p className="text-xs text-gray-500">{formatDate(r.createdAt)}</p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{tOr(`customRequestStatus.${r.status}`, r.status)}</span>
              </button>

              {expanded?.id === r.id && (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm">
                  {/* A-025 — account/payment/delivery questions go to the support team; the message thread
                      below stays the production discussion for this request (spec §19.3). */}
                  <Link
                    href={`/account/support/new?context=custom_request&id=${r.id}&label=${encodeURIComponent(r.requestNumber)}`}
                    className="inline-block text-xs font-medium text-brand-navy underline"
                  >
                    {t('supportChat.askAboutRequest')}
                  </Link>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <p>{t('customRequest.machineFormatValue', { value: expanded.machineFormat })}</p>
                    <p>{t('customRequest.sizeValue', { value: expanded.sizeValue ?? '—' })}</p>
                    {expanded.quotedPricePkr && <p>{t('customRequest.quotedPrice', { amount: String(expanded.quotedPricePkr) })}</p>}
                  </div>

                  {expanded.status === 'quote_sent' && (
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="mb-2 text-sm font-medium">{t('customRequest.quoteApprove', { amount: String(expanded.quotedPricePkr) })}</p>
                      <div className="flex gap-2">
                        <button onClick={() => approve()} className="rounded-md bg-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-navy">
                          {t('customRequest.approvePay')}
                        </button>
                      </div>
                    </div>
                  )}

                  {expanded.files.length > 0 && (
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-gray-700">{t('customRequest.deliveredFiles')}</p>
                      {expanded.files.map((f) => (
                        <button key={f.id} onClick={() => download(f)} className="me-2 rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100">
                          {t('customRequest.downloadFormat', { format: f.fileFormat })}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-700">{t('chat.messages')}</p>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                      {messages.map((m) => (
                        <div key={m.id} dir="auto" className={`text-sm ${m.senderRole === 'customer' ? 'text-brand-navy' : 'text-gray-600'}`}>
                          <span className="font-medium">{m.senderRole === 'customer' ? t('chat.you') : t('chat.admin')}:</span> {m.message}
                        </div>
                      ))}
                      {messages.length === 0 && <p className="text-xs text-gray-400">{t('chat.noMessages')}</p>}
                    </div>
                    {typingUser && <p className="mt-1 text-xs italic text-gray-400">{t('chat.adminTyping')}</p>}
                    <div className="mt-2 flex gap-2">
                      <input value={chatInput} onChange={(e) => onTyping(e.target.value)} placeholder={t('chat.addMoreInfo')} aria-label={t('chat.addMoreInfo')} className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm" />
                      <button onClick={sendMessage} className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                        {t('common.send')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
