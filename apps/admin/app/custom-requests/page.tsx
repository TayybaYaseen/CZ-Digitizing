'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ApiError, CustomRequestDto, CustomRequestMessageDto, CustomRequestStatus } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { inputClass } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const STATUS_TABS: { value: '' | CustomRequestStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'quote_sent', label: 'Quote sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_production', label: 'In production' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
];

// The status this request could next move to via the plain status dropdown (AC-2's side-states —
// need_more_info/revision_required/cancelled — are reachable this way too, alongside the
// happy-path chain; illegal jumps are still rejected server-side by custom-request-state-machine).
const NEXT_STATUSES: Record<string, CustomRequestStatus[]> = {
  new: ['reviewing', 'cancelled'],
  reviewing: ['quote_sent', 'need_more_info', 'cancelled'],
  need_more_info: ['reviewing', 'cancelled'],
  quote_sent: ['reviewing', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['ready', 'revision_required', 'cancelled'],
  revision_required: ['in_production', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

// docs/specs/2026-08-28-12-custom-design-requests.md AC-2/AC-3/AC-4/AC-5/AC-7/AC-8/AC-9 — admin
// inbox. Follows the same "list with inline expand" convention as /quotes rather than a separate
// /:id route, for consistency with the rest of this admin app.
export default function CustomRequestsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [items, setItems] = useState<CustomRequestDto[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | CustomRequestStatus>('');
  const [expanded, setExpanded] = useState<CustomRequestDto | null>(null);
  const [messages, setMessages] = useState<CustomRequestMessageDto[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [deliverFile, setDeliverFile] = useState<File | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const list = await apiFetch<CustomRequestDto[]>(`/api/custom-requests${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setItems(list);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load custom requests.', traceId: '' });
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  async function expand(req: CustomRequestDto) {
    if (expanded?.id === req.id) {
      setExpanded(null);
      socketRef.current?.disconnect();
      return;
    }
    setExpanded(req);
    setPrice(req.quotedPricePkr ?? '');
    setNotes(req.adminNotes ?? '');
    setActionError(null);
    try {
      const list = await apiFetch<CustomRequestMessageDto[]>(`/api/custom-requests/${req.id}/messages`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setMessages(list);
    } catch {
      setMessages([]);
    }
    socketRef.current?.disconnect();
    const socket = io(`${API_URL}/custom-requests`, { auth: { token: accessToken } });
    socket.on('connect', () => socket.emit('join', { customRequestId: req.id }));
    socket.on('message', (msg: CustomRequestMessageDto) => setMessages((prev) => [...prev, msg]));
    socketRef.current = socket;
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  function sendMessage() {
    if (!expanded || !chatInput.trim()) return;
    socketRef.current?.emit('message', { customRequestId: expanded.id, message: chatInput });
    setChatInput('');
  }

  async function onUpdateStatus(status: CustomRequestStatus) {
    if (!expanded) return;
    setActionError(null);
    try {
      const updated = await apiFetch<CustomRequestDto>(`/api/custom-requests/${expanded.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status }),
      });
      setExpanded(updated);
      setItems((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
      setSuccessMessage(`Custom request #${updated.requestNumber} is now "${status}".`);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to update status.', traceId: '' });
    }
  }

  async function onSaveNotes() {
    if (!expanded) return;
    setActionError(null);
    try {
      await apiFetch(`/api/custom-requests/${expanded.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ adminNotes: notes }) });
      setSuccessMessage('Notes saved.');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save notes.', traceId: '' });
    }
  }

  async function onSendQuote() {
    if (!expanded) return;
    setActionError(null);
    try {
      const updated = await apiFetch<CustomRequestDto>(`/api/custom-requests/${expanded.id}/quote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ quotedPricePkr: price, adminNotes: notes }),
      });
      setExpanded(updated);
      setSuccessMessage(`Quote sent for #${updated.requestNumber}.`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to send quote.', traceId: '' });
    }
  }

  // AC-5 — production tooling: deliver the final file once the request is in_production/ready.
  async function onDeliver() {
    if (!expanded || !deliverFile) return;
    setActionError(null);
    try {
      const body = new FormData();
      body.append('file', deliverFile);
      await apiFetch(`/api/custom-requests/${expanded.id}/files`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body });
      setSuccessMessage('File delivered to the customer.');
      setDeliverFile(null);
      const refreshed = await apiFetch<CustomRequestDto>(`/api/custom-requests/${expanded.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setExpanded(refreshed);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to deliver file.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Custom Design Requests</h1>
        <p className="mt-1 text-sm text-gray-500">Review, quote, produce, and deliver customer-submitted custom design requests.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${statusFilter === tab.value ? 'bg-gold-500 text-navy-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={actionError} />

      <Card padding="p-0">
        {items === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No custom requests yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((req) => (
              <li key={req.id} className="p-3">
                <button onClick={() => expand(req)} className="flex w-full items-center justify-between text-left text-sm">
                  <span className="font-medium text-navy-800">
                    #{req.requestNumber} — {req.customerEmail} <span className="text-gray-400">({new Date(req.createdAt).toLocaleDateString()})</span>
                  </span>
                  <span className="text-xs uppercase tracking-wide text-gray-500">{req.status}</span>
                </button>

                {expanded?.id === req.id && (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-xs text-gray-700">
                    <div className="grid grid-cols-2 gap-2">
                      <p>Gmail: {req.customerEmail}</p>
                      <p>WhatsApp: {req.customerWhatsapp ?? '—'}</p>
                      <p>Type: {req.requestType}</p>
                      <p>Machine format: {req.machineFormat}</p>
                      <p>Size: {req.sizeValue ?? '—'}</p>
                      <p>Fabric: {req.fabricType ?? '—'}</p>
                      <p>Payment status: {req.paymentStatus}</p>
                      <p>Designer: {req.designerName ?? 'Unassigned'}</p>
                      <p>Order: {req.orderId ? `#${req.orderId}` : '—'}</p>
                    </div>
                    {req.specialInstructions && <p>Instructions: {req.specialInstructions}</p>}
                    {req.imageUrl && <p>Main logo/artwork uploaded.</p>}
                    {req.references.length > 0 && <p>{req.references.length} additional reference upload(s).</p>}

                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-3">
                      <span className="font-semibold">Move to:</span>
                      {(NEXT_STATUSES[req.status] ?? []).map((next) => (
                        <Button key={next} size="sm" variant="outlineNavy" onClick={() => onUpdateStatus(next)}>
                          {next}
                        </Button>
                      ))}
                    </div>

                    <div className="space-y-2 rounded-md bg-gray-50 p-3">
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Admin notes" className={`${inputClass} text-xs`} rows={2} />
                      <Button size="sm" variant="outlineNavy" onClick={onSaveNotes}>
                        Save notes
                      </Button>
                    </div>

                    {req.status !== 'completed' && req.status !== 'cancelled' && (
                      <div className="flex items-center gap-2 rounded-md bg-gray-50 p-3">
                        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Quoted price (PKR)" className={`${inputClass} text-xs`} />
                        <Button size="sm" onClick={onSendQuote}>
                          Send quote
                        </Button>
                      </div>
                    )}

                    {(req.status === 'in_production' || req.status === 'ready') && (
                      <div className="flex items-center gap-2 rounded-md bg-gray-50 p-3">
                        <input type="file" onChange={(e) => setDeliverFile(e.target.files?.[0] ?? null)} className="text-xs" />
                        <Button size="sm" onClick={onDeliver} disabled={!deliverFile}>
                          Deliver file
                        </Button>
                      </div>
                    )}

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="font-semibold">Messages</p>
                      <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                        {messages.map((m) => (
                          <div key={m.id} className={m.senderRole === 'customer' ? 'text-gray-600' : 'text-navy-800'}>
                            <span className="font-medium">{m.senderRole === 'customer' ? 'Customer' : 'You'}:</span> {m.message}
                          </div>
                        ))}
                        {messages.length === 0 && <p className="text-gray-400">No messages yet.</p>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Reply…" className={`${inputClass} text-xs`} />
                        <Button size="sm" variant="outlineNavy" onClick={sendMessage}>
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
