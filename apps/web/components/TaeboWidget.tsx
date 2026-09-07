'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaeboMessageDto, TaeboReplyDto, TaeboSuggestionDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

// docs/specs/2026-08-28-15-taebo-chatbot.md (aspect A-020). Floating widget on every public page
// (spec §5 Route(s)) — mounted once in app/layout.tsx.

const SESSION_KEY = 'czd.taebo.sessionId';
const GREETED_KEY = 'czd.taebo.greeted';
const IDLE_MS = 30000;

interface DisplayMessage {
  id: string;
  sender: 'customer' | 'taebo' | 'admin';
  text: string;
  escalated?: boolean;
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface PublicSettings {
  whatsappNumber: string | null;
}

export function TaeboWidget() {
  const pathname = usePathname();
  const { accessToken } = useAuth();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TaeboSuggestionDto[]>([]);
  const [proactiveOffer, setProactiveOffer] = useState<TaeboSuggestionDto | null>(null);
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);

  const sessionIdRef = useRef<string>('');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    apiFetch<PublicSettings>('/api/settings/public')
      .then((s) => setWhatsappHref(s.whatsappNumber ? `https://wa.me/${s.whatsappNumber.replace(/[^\d]/g, '')}` : null))
      .catch(() => setWhatsappHref(null));
  }, []);

  // AC-1 — greets once per session, never re-triggers the greeting on later navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(GREETED_KEY)) return;
    window.sessionStorage.setItem(GREETED_KEY, '1');
    setMessages([{ id: 'greeting', sender: 'taebo', text: "Hi, I'm Taebo! 🐼 Ask me anything, or open chat any time you need help." }]);
  }, []);

  useEffect(() => {
    apiFetch<TaeboSuggestionDto[]>(`/api/taebo/suggestions?page=${encodeURIComponent(pathname ?? '/')}`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [pathname]);

  // AC-9 — proactive suggestion after an idle threshold on a page with common questions, without
  // requiring the customer to open chat first.
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setProactiveOffer(null);
    if (open) return;
    idleTimerRef.current = setTimeout(() => {
      apiFetch<TaeboSuggestionDto[]>(`/api/taebo/suggestions?page=${encodeURIComponent(pathname ?? '/')}`)
        .then((rows) => {
          if (rows[0]) setProactiveOffer(rows[0]);
        })
        .catch(() => undefined);
    }, IDLE_MS);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [pathname, open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError(false);
      setInput('');
      setProactiveOffer(null);
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'customer', text: trimmed }]);
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const reply = await apiFetch<TaeboReplyDto>('/api/taebo/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: trimmed,
            conversationId,
            sessionId: sessionIdRef.current,
            page: pathname ?? undefined,
          }),
        });
        setConversationId(reply.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'taebo',
            text: reply.escalated
              ? "I've passed this to our team — you'll hear back soon."
              : (reply.answer ?? ''),
            escalated: reply.escalated,
          },
        ]);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, conversationId, loading, pathname],
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {!open && proactiveOffer && (
        <button
          onClick={() => {
            setOpen(true);
            void send(proactiveOffer.question);
          }}
          className="max-w-xs rounded-lg bg-white px-4 py-2 text-left text-sm text-brand-navy shadow-lg ring-1 ring-black/10"
        >
          Need help with <span className="font-medium">{proactiveOffer.question}</span>?
        </button>
      )}

      {open && (
        <div className="flex h-96 w-80 flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between bg-brand-navy px-4 py-3 text-white">
            <span className="font-medium">🐼 Taebo Helping Panda</span>
            <button onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {messages.every((m) => m.id === 'greeting') && suggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Common questions:</p>
                {suggestions.map((s) => (
                  <button
                    key={s.faqId}
                    onClick={() => void send(s.question)}
                    className="block w-full rounded bg-brand-lightGray px-2 py-1 text-left hover:bg-gray-200"
                  >
                    {s.question}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.sender === 'customer' ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${
                    m.sender === 'customer'
                      ? 'bg-brand-navy text-white'
                      : m.escalated
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-brand-lightGray text-brand-navy'
                  }`}
                >
                  {m.text}
                </span>
              </div>
            ))}
            {loading && <div className="text-xs text-gray-400">Taebo is typing…</div>}
            {error && (
              <div className="flex items-center justify-between rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                <span>Something went wrong.</span>
                <button onClick={() => void send(input || messages.at(-2)?.text || '')} className="font-medium underline">
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="border-t p-2">
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="mb-2 block text-center text-xs text-green-700 underline">
                Prefer WhatsApp? Chat with our team
              </a>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Taebo a question…"
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <button type="submit" disabled={loading} className="rounded bg-brand-navy px-3 py-1 text-sm text-white disabled:opacity-50">
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Taebo chat"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy text-2xl text-white shadow-lg"
        >
          🐼
        </button>
      )}
    </div>
  );
}
