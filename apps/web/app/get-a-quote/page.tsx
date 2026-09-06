'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { ApiError, QuoteDto, QuoteMessageDto, QuoteQuestionDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

interface ServiceSummaryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
}
interface MainServiceDto extends ServiceSummaryDto {
  subServices: ServiceSummaryDto[];
}

type Step = 1 | 2 | 3;

// docs/specs/2026-08-28-11-smart-get-a-quote.md AC-1-AC-9 — the guided 3-step quote flow.
export default function GetAQuotePage() {
  return (
    <Suspense>
      <GetAQuoteForm />
    </Suspense>
  );
}

function GetAQuoteForm() {
  const searchParams = useSearchParams();
  const preselectedSlug = searchParams.get('service');
  const autoSelectedRef = useRef(false);

  const [step, setStep] = useState<Step>(1);
  const [services, setServices] = useState<MainServiceDto[] | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceSummaryDto | null>(null);
  const [questions, setQuestions] = useState<QuoteQuestionDto[] | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', country: '', size: '', quantity: '1', fabric: '', threadColors: '', formatPreference: '', deadline: '', instructions: '' });
  const [file, setFile] = useState<File | null>(null);

  const [messages, setMessages] = useState<QuoteMessageDto[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    apiFetch<MainServiceDto[]>('/api/services')
      .then(setServices)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load services.', traceId: '' }));
  }, []);

  // AC-7/AC-11 — a service/sub-service page's "Get a Quote" CTA links here with ?service=<slug>,
  // pre-selecting Step 1 and jumping straight to Step 2.
  useEffect(() => {
    if (!preselectedSlug || autoSelectedRef.current || services === null) return;
    autoSelectedRef.current = true;
    const flat = services.flatMap((s) => [s, ...s.subServices]);
    const match = flat.find((s) => s.slug === preselectedSlug);
    if (match) selectService(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, preselectedSlug]);

  // AC-1 — Step 2's questions, scoped to the selected service.
  async function selectService(service: ServiceSummaryDto) {
    setSelectedService(service);
    setError(null);
    try {
      const list = await apiFetch<QuoteQuestionDto[]>(`/api/quote-questions?serviceId=${service.id}`);
      setQuestions(list);
      // AC-9 foundation — a draft quote is created as soon as the customer reaches this point, so
      // the embedded chat (Step 3) has something to attach messages to.
      const draft = await apiFetch<QuoteDto>('/api/quotes/draft', { method: 'POST', body: JSON.stringify({ serviceId: service.id }) });
      setQuote(draft);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not start a quote for this service.', traceId: '' });
    }
  }

  function goToStep3() {
    setStep(3);
    loadMessages();
  }

  async function loadMessages() {
    if (!quote) return;
    try {
      const list = await apiFetch<QuoteMessageDto[]>(`/api/quotes/${quote.id}/messages`, { headers: { 'x-quote-access-token': quote.accessToken ?? '' } });
      setMessages(list);
    } catch {
      // best-effort — chat history just stays empty on failure
    }
  }

  async function sendMessage() {
    if (!quote || !chatInput.trim()) return;
    try {
      const message = await apiFetch<QuoteMessageDto>(`/api/quotes/${quote.id}/messages`, {
        method: 'POST',
        headers: { 'x-quote-access-token': quote.accessToken ?? '' },
        body: JSON.stringify({ body: chatInput }),
      });
      setMessages((prev) => [...prev, message]);
      setChatInput('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not send message.', traceId: '' });
    }
  }

  // AC-4 — PATCHes the draft's fields, then submits (with the optional design upload).
  async function onSubmit() {
    if (!quote) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'x-quote-access-token': quote.accessToken ?? '' },
        body: JSON.stringify({ ...form, quantity: form.quantity ? Number(form.quantity) : undefined }),
      });

      const body = new FormData();
      if (file) body.append('file', file);
      await apiFetch(`/api/quotes/${quote.id}/submit`, {
        method: 'POST',
        headers: { 'x-quote-access-token': quote.accessToken ?? '' },
        body,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not submit your quote request.', traceId: '' });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-2xl font-bold">Quote request received</h1>
        <p className="text-sm text-gray-600">Thanks — we&apos;ve got your request and typically respond within 1-2 business days. You&apos;ll receive an email confirmation shortly.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Get a Quote</h1>
        <p className="mt-1 text-sm text-gray-600">Step {step} of 3</p>
      </div>

      <ErrorBanner error={error} />

      {step === 1 && (
        <div className="space-y-4">
          {services === null ? (
            <p className="text-sm text-gray-400">Loading services…</p>
          ) : (
            services.map((main) => (
              <div key={main.id} className="space-y-2">
                <button onClick={() => selectService(main)} className="block w-full rounded-lg border border-gray-200 p-4 text-left hover:border-brand-navy">
                  <p className="font-semibold">{main.name}</p>
                  <p className="text-sm text-gray-600">{main.description}</p>
                </button>
                {main.subServices.length > 0 && (
                  <div className="ml-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {main.subServices.map((sub) => (
                      <button key={sub.id} onClick={() => selectService(sub)} className="rounded-md border border-gray-200 p-2 text-left text-xs hover:border-brand-navy">
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {step === 2 && selectedService && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Common questions about {selectedService.name}:</p>
          {questions === null ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-gray-500">No common questions yet — ask us directly.</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {questions.map((q) => (
                <div key={q.id} className="px-4 py-3">
                  <button onClick={() => setOpenQuestionId(openQuestionId === q.id ? null : q.id)} className="w-full text-left text-sm font-medium text-brand-navy">
                    {q.question}
                  </button>
                  {openQuestionId === q.id && <p className="mt-2 text-sm text-gray-700">{q.answer}</p>}
                </div>
              ))}
            </div>
          )}
          <button onClick={goToStep3} className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-110">
            Ask a Question / Continue to Quote Form
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Quantity" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Fabric" value={form.fabric} onChange={(e) => setForm({ ...form, fabric: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Thread colors" value={form.threadColors} onChange={(e) => setForm({ ...form, threadColors: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Machine/file format preference" value={form.formatPreference} onChange={(e) => setForm({ ...form, formatPreference: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <textarea placeholder="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm" rows={3} />
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="col-span-2 text-sm" />
          </form>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-700">Have a question before you submit?</p>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={`text-sm ${m.senderRole === 'customer' ? 'text-brand-navy' : 'text-gray-600'}`}>
                  <span className="font-medium">{m.senderRole === 'customer' ? 'You' : 'Admin'}:</span> {m.body}
                </div>
              ))}
              {messages.length === 0 && <p className="text-xs text-gray-400">No messages yet.</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask a question…" className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm" />
              <button onClick={sendMessage} className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                Send
              </button>
            </div>
          </div>

          <button onClick={onSubmit} disabled={submitting} className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-110 disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit Quote Request'}
          </button>
        </div>
      )}
    </div>
  );
}
