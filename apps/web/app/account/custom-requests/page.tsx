'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ApiError, CustomRequestDto, CustomRequestFileDto, CustomRequestMessageDto, CustomRequestSummaryDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const STATUS_LABEL: Record<string, string> = {
  new: 'Submitted',
  reviewing: 'Under review',
  quote_sent: 'Quote ready',
  approved: 'Approved — awaiting payment',
  in_production: 'In production',
  ready: 'Ready',
  delivered: 'Delivered',
  completed: 'Completed',
  need_more_info: 'More info needed',
  revision_required: 'Revision in progress',
  cancelled: 'Cancelled',
};

// docs/specs/2026-08-28-12-custom-design-requests.md §5 — /account/custom-requests. Follows the
// same "list with inline expand" convention as /account/quotes and admin's /quotes page rather
// than a separate /:id route, for consistency with the rest of this codebase.
export default function MyCustomRequestsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
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
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load your custom requests.', traceId: '' });
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
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load this request.', traceId: '' });
    }
  }

  // AC-8 — live message delivery + typing indicator over the custom-requests WebSocket gateway.
  function connectSocket(customRequestId: string) {
    socketRef.current?.disconnect();
    const socket = io(`${API_URL}/custom-requests`, { auth: { token: accessToken } });
    socket.on('connect', () => socket.emit('join', { customRequestId }));
    socket.on('message', (msg: CustomRequestMessageDto) => setMessages((prev) => [...prev, msg]));
    socket.on('typing', ({ isTyping }: { isTyping: boolean }) => setTypingUser(isTyping ? 'Admin is typing…' : null));
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

  async function approve(paymentMethod: 'bank_transfer' | 'paypal' | 'stripe') {
    if (!expanded || !accessToken) return;
    setError(null);
    try {
      await apiFetch(`/api/custom-requests/${expanded.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ paymentMethod }),
      });
      await expand(expanded.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not approve the quote.', traceId: '' });
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
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not start the download.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Custom Requests</h1>
        <p className="mt-1 text-sm text-gray-600">Track your custom digitizing/vectorizing requests.</p>
      </div>

      <ErrorBanner error={error} />

      {items === null ? (
        <p className="text-center text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>No custom requests yet.</p>
          <a href="/custom-request" className="mt-2 inline-block text-brand-navy underline">
            Submit a Custom Request
          </a>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {items.map((r) => (
            <li key={r.id} className="p-4">
              <button onClick={() => expand(r.id)} className="flex w-full items-center justify-between text-left text-sm">
                <div>
                  <p className="font-medium">#{r.requestNumber}</p>
                  <p className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{STATUS_LABEL[r.status] ?? r.status}</span>
              </button>

              {expanded?.id === r.id && (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <p>Machine format: {expanded.machineFormat}</p>
                    <p>Size: {expanded.sizeValue ?? '—'}</p>
                    {expanded.quotedPricePkr && <p>Quoted price: PKR {expanded.quotedPricePkr}</p>}
                  </div>

                  {expanded.status === 'quote_sent' && (
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="mb-2 text-sm font-medium">Quote: PKR {expanded.quotedPricePkr} — approve to proceed</p>
                      <div className="flex gap-2">
                        <button onClick={() => approve('bank_transfer')} className="rounded-md bg-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-navy">
                          Approve — Bank Transfer
                        </button>
                        <button onClick={() => approve('paypal')} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs">
                          Approve — PayPal
                        </button>
                      </div>
                    </div>
                  )}

                  {expanded.files.length > 0 && (
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-gray-700">Delivered files</p>
                      {expanded.files.map((f) => (
                        <button key={f.id} onClick={() => download(f)} className="mr-2 rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100">
                          Download .{f.fileFormat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-700">Messages</p>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                      {messages.map((m) => (
                        <div key={m.id} className={`text-sm ${m.senderRole === 'customer' ? 'text-brand-navy' : 'text-gray-600'}`}>
                          <span className="font-medium">{m.senderRole === 'customer' ? 'You' : 'Admin'}:</span> {m.message}
                        </div>
                      ))}
                      {messages.length === 0 && <p className="text-xs text-gray-400">No messages yet.</p>}
                    </div>
                    {typingUser && <p className="mt-1 text-xs italic text-gray-400">{typingUser}</p>}
                    <div className="mt-2 flex gap-2">
                      <input value={chatInput} onChange={(e) => onTyping(e.target.value)} placeholder="Add more info…" className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm" />
                      <button onClick={sendMessage} className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                        Send
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
