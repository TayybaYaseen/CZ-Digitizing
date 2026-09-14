'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ApiError,
  CustomRequestDto,
  CustomRequestMessageDto,
  CustomRequestProductionFileDto,
  CustomRequestStatus,
  CustomRequestTaskDto,
  CustomRequestTimeEntryDto,
} from '@czd/shared-types';
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

  // AC-9 — designer production tooling: task checklist, time tracking, versioned production files.
  const [tasks, setTasks] = useState<CustomRequestTaskDto[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [timeEntries, setTimeEntries] = useState<CustomRequestTimeEntryDto[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [timeMinutes, setTimeMinutes] = useState('');
  const [timeNote, setTimeNote] = useState('');
  const [productionFiles, setProductionFiles] = useState<CustomRequestProductionFileDto[]>([]);
  const [productionFile, setProductionFile] = useState<File | null>(null);
  const [productionNote, setProductionNote] = useState('');

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
    await loadProductionExtras(req.id);
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

  // AC-9 — loads the three production-tooling panels together whenever a request is expanded.
  async function loadProductionExtras(requestId: string) {
    try {
      const [taskList, timeList, fileList] = await Promise.all([
        apiFetch<CustomRequestTaskDto[]>(`/api/custom-requests/${requestId}/tasks`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<{ entries: CustomRequestTimeEntryDto[]; totalMinutes: number }>(`/api/custom-requests/${requestId}/time-entries`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        apiFetch<CustomRequestProductionFileDto[]>(`/api/custom-requests/${requestId}/production-files`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setTasks(taskList);
      setTimeEntries(timeList.entries);
      setTotalMinutes(timeList.totalMinutes);
      setProductionFiles(fileList);
    } catch {
      setTasks([]);
      setTimeEntries([]);
      setTotalMinutes(0);
      setProductionFiles([]);
    }
  }

  async function onAddTask() {
    if (!expanded || !newTaskTitle.trim()) return;
    setActionError(null);
    try {
      const task = await apiFetch<CustomRequestTaskDto>(`/api/custom-requests/${expanded.id}/tasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title: newTaskTitle }),
      });
      setTasks((prev) => [...prev, task]);
      setNewTaskTitle('');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to add task.', traceId: '' });
    }
  }

  async function onToggleTask(task: CustomRequestTaskDto) {
    if (!expanded) return;
    setActionError(null);
    try {
      const updated = await apiFetch<CustomRequestTaskDto>(`/api/custom-requests/${expanded.id}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ done: !task.done }),
      });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to update task.', traceId: '' });
    }
  }

  async function onDeleteTask(taskId: string) {
    if (!expanded) return;
    setActionError(null);
    try {
      await apiFetch(`/api/custom-requests/${expanded.id}/tasks/${taskId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete task.', traceId: '' });
    }
  }

  async function onLogTime() {
    if (!expanded || !timeMinutes) return;
    setActionError(null);
    try {
      const entry = await apiFetch<CustomRequestTimeEntryDto>(`/api/custom-requests/${expanded.id}/time-entries`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ minutes: Number(timeMinutes), note: timeNote || undefined }),
      });
      setTimeEntries((prev) => [entry, ...prev]);
      setTotalMinutes((prev) => prev + entry.minutes);
      setTimeMinutes('');
      setTimeNote('');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to log time.', traceId: '' });
    }
  }

  async function onDeleteTimeEntry(entry: CustomRequestTimeEntryDto) {
    if (!expanded) return;
    setActionError(null);
    try {
      await apiFetch(`/api/custom-requests/${expanded.id}/time-entries/${entry.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      setTimeEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setTotalMinutes((prev) => prev - entry.minutes);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete time entry.', traceId: '' });
    }
  }

  async function onUploadProductionFile() {
    if (!expanded || !productionFile) return;
    setActionError(null);
    try {
      const body = new FormData();
      body.append('file', productionFile);
      if (productionNote) body.append('note', productionNote);
      const file = await apiFetch<CustomRequestProductionFileDto>(`/api/custom-requests/${expanded.id}/production-files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });
      setProductionFiles((prev) => [file, ...prev]);
      setProductionFile(null);
      setProductionNote('');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to upload production file.', traceId: '' });
    }
  }

  // Staff-only direct byte stream (see CustomRequestProductionService) — apiFetch always parses
  // JSON, so this one download uses a plain authenticated fetch + Blob instead.
  async function onDownloadProductionFile(file: CustomRequestProductionFileDto) {
    if (!expanded) return;
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/custom-requests/${expanded.id}/production-files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `custom-request-${expanded.id}-v${file.version}.${file.fileFormat}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError({ code: 'INTERNAL_ERROR', message: 'Failed to download production file.', traceId: '' });
    }
  }

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
                      <p className="font-semibold">Production checklist</p>
                      <div className="mt-2 space-y-1">
                        {tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-2">
                            <input type="checkbox" checked={task.done} onChange={() => onToggleTask(task)} className="h-3.5 w-3.5" />
                            <span className={task.done ? 'flex-1 text-gray-400 line-through' : 'flex-1'}>{task.title}</span>
                            <button onClick={() => onDeleteTask(task.id)} className="text-gray-400 hover:text-red-500" aria-label="Delete task">
                              ✕
                            </button>
                          </div>
                        ))}
                        {tasks.length === 0 && <p className="text-gray-400">No tasks yet.</p>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Add a task…"
                          className={`${inputClass} text-xs`}
                          onKeyDown={(e) => e.key === 'Enter' && onAddTask()}
                        />
                        <Button size="sm" variant="outlineNavy" onClick={onAddTask} disabled={!newTaskTitle.trim()}>
                          Add
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="font-semibold">
                        Time tracking <span className="font-normal text-gray-500">— {totalMinutes} min logged</span>
                      </p>
                      <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                        {timeEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between">
                            <span>
                              {entry.designerName} — {entry.minutes} min{entry.note ? `: ${entry.note}` : ''}
                            </span>
                            <button onClick={() => onDeleteTimeEntry(entry)} className="text-gray-400 hover:text-red-500" aria-label="Delete time entry">
                              ✕
                            </button>
                          </div>
                        ))}
                        {timeEntries.length === 0 && <p className="text-gray-400">No time logged yet.</p>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={timeMinutes}
                          onChange={(e) => setTimeMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="Minutes"
                          className={`${inputClass} w-20 text-xs`}
                        />
                        <input value={timeNote} onChange={(e) => setTimeNote(e.target.value)} placeholder="Note (optional)" className={`${inputClass} text-xs`} />
                        <Button size="sm" variant="outlineNavy" onClick={onLogTime} disabled={!timeMinutes}>
                          Log
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="font-semibold">Production files (versions)</p>
                      <div className="mt-2 space-y-1">
                        {productionFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between">
                            <span>
                              v{file.version} — {file.uploadedByName}
                              {file.note ? `: ${file.note}` : ''} ({new Date(file.createdAt).toLocaleString()})
                            </span>
                            <button onClick={() => onDownloadProductionFile(file)} className="font-medium text-navy-700 underline">
                              Download
                            </button>
                          </div>
                        ))}
                        {productionFiles.length === 0 && <p className="text-gray-400">No production files uploaded yet.</p>}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="file" onChange={(e) => setProductionFile(e.target.files?.[0] ?? null)} className="text-xs" />
                        <input value={productionNote} onChange={(e) => setProductionNote(e.target.value)} placeholder="Note (optional)" className={`${inputClass} text-xs`} />
                        <Button size="sm" variant="outlineNavy" onClick={onUploadProductionFile} disabled={!productionFile}>
                          Upload version
                        </Button>
                      </div>
                    </div>

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
