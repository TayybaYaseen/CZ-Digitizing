'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TaeboNoticeKey, TaeboReplyDto, TaeboSuggestionDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useLocale, type TranslationKey } from '@/lib/locale-context';
import { useTaeboPosition, type TaeboPosition } from '@/lib/use-taebo-position';
import { TaeboPanda, type TaeboPose } from './TaeboPanda';

// §13-16 — site-wide navigation shortcuts shown once, before the first message. Every href is an
// existing route (no invented pages); Embroidery Digitizing/Vector Art both land on /services since
// that's the one real Services page covering both (ServicesSummary.tsx), and File Formats routes to
// /faq since there is no dedicated customer-facing file-format page to link instead.
// i18n (A-021): labels are translation keys; "Vector Art" is a brand name and stays literal.
const QUICK_ACTIONS: { label: TranslationKey | 'Vector Art'; href: string }[] = [
  { label: 'taebo.quick.browseDesigns', href: '/designs' },
  { label: 'nav.designCategories', href: '/categories' },
  { label: 'services.embroideryDigitizing', href: '/services' },
  { label: 'Vector Art', href: '/services' },
  { label: 'nav.getAQuote', href: '/get-a-quote' },
  { label: 'nav.customRequest', href: '/custom-request' },
  { label: 'taebo.quick.ordersDownloads', href: '/account/orders' },
  { label: 'taebo.quick.fileFormats', href: '/faq' },
  { label: 'taebo.quick.contactSupport', href: '/contact' },
];

// docs/specs/2026-08-28-15-taebo-chatbot.md (aspect A-020) + §10 "Character & Interaction System".
// Floating widget on every public page (spec §5 Route(s)) — mounted once in app/layout.tsx.
//
// This file owns the SAME chatbot state machine it always has (messages/loading/error/suggestions
// below) — §10.7 maps that existing state onto Taebo's visual pose (see `derivePose`) rather than
// introducing a second, parallel state machine. Drag/position/reset are the only genuinely new
// pieces of state here, and they live in `useTaeboPosition` (a client-side UI preference only).

const SESSION_KEY = 'czd.taebo.sessionId';
const GREETED_KEY = 'czd.taebo.greeted';
const IDLE_MS = 30000;
const SCROLL_REVEAL_PX = 200;
const PANEL_WIDTH = 320; // w-80
const PANEL_HEIGHT = 384; // h-96
const BUBBLE_WIDTH = 288; // max-w-xs
const BUBBLE_HEIGHT = 72;
const FLOAT_MARGIN = 16;
const FLOAT_GAP = 8;

// i18n (A-021): the greeting, the escalation notices and fixed conversational replies (`noticeKey`)
// are Taebo's own UI copy, so they are rendered with t() at display time — they follow a later
// language switch too. `text` is only ever the customer's own words or an API-supplied answer
// (grounded in approved content, or the LLM's own reply in the customer's language).
interface DisplayMessage {
  id: string;
  sender: 'customer' | 'taebo' | 'admin';
  text: string;
  escalated?: boolean;
  noticeKey?: TaeboNoticeKey;
  options?: TaeboSuggestionDto[];
}

const GREETING_MESSAGE: DisplayMessage = { id: 'greeting', sender: 'taebo', text: '' };

function taeboText(m: DisplayMessage, t: (key: TranslationKey) => string): string {
  if (m.id === 'greeting') return t('taebo.greeting');
  if (m.escalated) return t(m.noticeKey === 'account' ? 'taebo.escalatedAccount' : 'taebo.escalated');
  if (m.noticeKey) return t(`taebo.notice.${m.noticeKey}` as TranslationKey);
  if (m.options?.length) return t('taebo.didYouMean');
  return m.text;
}

// Answers may point to a site section ("see /pricing") — render those as in-app links. Only a
// slash at the start of a word counts, so "monthly/yearly" stays plain text.
function linkifyPaths(text: string): ReactNode[] {
  return text.split(/((?:^|(?<=[\s(]))\/[a-z][a-z0-9\-/]*[a-z0-9])/g).map((part, i) =>
    /^\/[a-z]/.test(part) ? (
      // <bdi dir="ltr"> keeps the path reading correctly inside Arabic/Urdu (RTL) answers.
      <Link key={i} href={part} className="font-medium text-brand-gold underline">
        <bdi dir="ltr">{part}</bdi>
      </Link>
    ) : (
      part
    ),
  );
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

// §10.7 pose mapping — reuses the chat's own loading/error/messages state, no new flags:
// loading -> thinking; a fetch error or an escalated reply -> waiting (Part 4 STATE 8's "error
// state must not pretend to know an answer" is exactly AC-3/AC-4's existing escalation, reused
// here rather than re-implemented); a matched reply -> helping; the one-time-per-session greeting
// -> greeting; otherwise -> idle.
function derivePose(loading: boolean, error: boolean, messages: DisplayMessage[], firstVisit: boolean): TaeboPose {
  if (loading) return 'thinking';
  if (error) return 'waiting';
  const last = messages[messages.length - 1];
  if (last && last.sender === 'taebo' && last.id !== 'greeting') {
    return last.escalated ? 'waiting' : 'helping';
  }
  if (firstVisit && messages.length === 1 && messages[0]?.id === 'greeting') return 'greeting';
  return 'idle';
}

interface LauncherSize {
  width: number;
  height: number;
}

// Keeps the panel/proactive-bubble fully on-screen regardless of where the launcher was dragged —
// prefers the launcher's original above/right-aligned corner, falls back to below/left-aligned when
// there isn't room, then hard-clamps as a last resort (Part 7: never allowed to render off-screen).
function floatingStyle(anchor: TaeboPosition | null, launcherSize: LauncherSize, width: number, height: number): React.CSSProperties {
  if (!anchor || typeof window === 'undefined') {
    return { right: FLOAT_MARGIN, bottom: launcherSize.height + FLOAT_MARGIN + FLOAT_GAP };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchor.left + launcherSize.width - width; // right-aligned to the launcher, opening leftward
  if (left < FLOAT_MARGIN) left = anchor.left; // not enough room — left-align to the launcher instead
  left = Math.min(Math.max(left, FLOAT_MARGIN), Math.max(vw - width - FLOAT_MARGIN, FLOAT_MARGIN));

  let top = anchor.top - height - FLOAT_GAP; // opens upward by default
  if (top < FLOAT_MARGIN) top = anchor.top + launcherSize.height + FLOAT_GAP; // not enough room — open downward
  top = Math.min(Math.max(top, FLOAT_MARGIN), Math.max(vh - height - FLOAT_MARGIN, FLOAT_MARGIN));

  return { left, top };
}

export function TaeboWidget() {
  const pathname = usePathname();
  const { accessToken, user } = useAuth();
  const { t, locale } = useLocale();
  const { position, launcherSize, onPointerDown, onPointerMove, onPointerUp, reset: resetPosition } = useTaeboPosition();

  const [open, setOpen] = useState(false);
  const [scrolledIn, setScrolledIn] = useState(false);
  // The chat always opens on the greeting — never on an auto-picked question.
  const [messages, setMessages] = useState<DisplayMessage[]>([GREETING_MESSAGE]);
  const [firstVisit, setFirstVisit] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // The customer's message whose request failed — what "Retry" re-sends.
  const [failedText, setFailedText] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TaeboSuggestionDto[]>([]);
  const [proactiveOffer, setProactiveOffer] = useState(false);
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);

  const sessionIdRef = useRef<string>('');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justDraggedRef = useRef(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const error = failedText !== null;
  const pose = useMemo(() => derivePose(loading, error, messages, firstVisit), [loading, error, messages, firstVisit]);
  const onlyGreeting = messages.length === 1 && messages[0]?.id === 'greeting';

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    apiFetch<PublicSettings>('/api/settings/public')
      .then((s) => setWhatsappHref(s.whatsappNumber ? `https://wa.me/${s.whatsappNumber.replace(/[^\d]/g, '')}` : null))
      .catch(() => setWhatsappHref(null));
  }, []);

  // The face avatar eases into view once the customer scrolls, rather than sitting in the corner
  // from the very first paint. A page short enough to need no scrolling shows it immediately
  // instead of hiding the mascot (and the chat entry point) forever.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkScroll = () => {
      const pastThreshold = window.scrollY > SCROLL_REVEAL_PX;
      const pageTooShortToScroll = document.documentElement.scrollHeight <= window.innerHeight + SCROLL_REVEAL_PX;
      setScrolledIn(pastThreshold || pageTooShortToScroll);
    };
    checkScroll();
    window.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  // AC-1 — the greeting itself is always the first message in the chat, but Taebo only waves it
  // (the 'greeting' pose) once per session, never re-triggering on later navigation. The greeting
  // is deliberately short and generic — never a fabricated or auto-picked example question (Part 4
  // STATE 2; docs/incidents/2026-09-13-taebo-character-interaction-system.md).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(GREETED_KEY)) return;
    window.sessionStorage.setItem(GREETED_KEY, '1');
    setFirstVisit(true);
  }, []);

  useEffect(() => {
    apiFetch<TaeboSuggestionDto[]>(`/api/taebo/suggestions?page=${encodeURIComponent(pathname ?? '/')}`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [pathname]);

  // AC-9 — after an idle threshold on a page with common questions, Taebo proactively offers help
  // without requiring the customer to open chat first. The bubble shows the greeting and opens the
  // chat; it used to quote the first FAQ verbatim ("Need help with What is the difference…??") and
  // send it on the customer's behalf.
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setProactiveOffer(false);
    if (open) return;
    idleTimerRef.current = setTimeout(() => {
      apiFetch<TaeboSuggestionDto[]>(`/api/taebo/suggestions?page=${encodeURIComponent(pathname ?? '/')}`)
        .then((rows) => {
          if (rows.length > 0) setProactiveOffer(true);
        })
        .catch(() => undefined);
    }, IDLE_MS);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [pathname, open]);

  const send = useCallback(
    async (text: string, isRetry = false) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setFailedText(null);
      setInput('');
      setProactiveOffer(false);
      if (!isRetry) setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'customer', text: trimmed }]);
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
            languageCode: locale,
          }),
        });
        setConversationId(reply.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'taebo',
            text: reply.escalated ? '' : (reply.answer ?? ''),
            escalated: reply.escalated,
            noticeKey: reply.noticeKey,
            options: reply.options,
          },
        ]);
      } catch {
        setFailedText(trimmed);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, conversationId, loading, pathname, locale],
  );

  // Keep the newest message (or the typing indicator) in view as the conversation grows.
  useEffect(() => {
    const el = messagesRef.current;
    if (el && !onlyGreeting) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open, onlyGreeting]);

  // Part 6 — a drag that moved past the threshold must not also open the chat once the pointer is
  // released (a plain click still fires right after pointerup with no movement in between).
  function onLauncherPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    justDraggedRef.current = onPointerUp(e);
  }

  function onLauncherClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setOpen(true);
  }

  // Clamped down from the base 320x384 on narrow phones (Part 25's 375/390/414px sweep) so the
  // panel never has to overflow horizontally to fit — same margin the launcher/bubble already clamp
  // against.
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const panelWidth = Math.min(PANEL_WIDTH, viewportWidth - FLOAT_MARGIN * 2);
  const panelHeight = Math.min(PANEL_HEIGHT, viewportHeight - FLOAT_MARGIN * 2);

  const panelStyle = floatingStyle(position, launcherSize, panelWidth, panelHeight);
  const bubbleStyle = floatingStyle(position, launcherSize, BUBBLE_WIDTH, BUBBLE_HEIGHT);
  const launcherStyle: React.CSSProperties = position
    ? { left: position.left, top: position.top }
    : { right: FLOAT_MARGIN, bottom: FLOAT_MARGIN };

  // A-025 — hidden on the human-support chat pages so the launcher never covers the composer/Send
  // button on phones and the two chats never compete for the same corner (spec §8.3/§23).
  if (pathname?.startsWith('/account/support')) return null;

  return (
    <>
      {!open && proactiveOffer && (
        <button
          onClick={() => {
            setProactiveOffer(false);
            setOpen(true);
          }}
          className="taebo-motion-safe fixed z-50 max-w-xs whitespace-pre-line break-words rounded-lg bg-white px-4 py-2 text-start text-sm leading-snug text-brand-navy shadow-lg ring-1 ring-black/10 transition-opacity"
          style={{ ...bubbleStyle, width: BUBBLE_WIDTH }}
        >
          {t('taebo.greeting')}
        </button>
      )}

      {open && (
        <div
          className="taebo-motion-safe fixed z-50 flex flex-col overflow-hidden rounded-card bg-brand-navy shadow-cz-navy ring-1 ring-white/10 transition-opacity"
          style={{ ...panelStyle, width: panelWidth, height: panelHeight }}
        >
          {/* §14/§15 — the assistant's name is TAEBO; the panda is the character, not the name. */}
          <div className="flex items-center justify-between border-b border-white/10 bg-navy-800 px-3 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex">
                <TaeboPanda variant="head" pose={pose} className="h-9 w-9 rounded-full" />
                <span
                  className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-navy-800 bg-emerald-400"
                  aria-hidden="true"
                  title={t('taebo.online')}
                />
              </span>
              <div className="leading-tight">
                <p className="font-display font-semibold">TAEBO</p>
                <p className="text-[11px] text-brand-silver/70">{t('taebo.subtitle')}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t('taebo.close')} className="text-brand-silver hover:text-brand-gold">✕</button>
          </div>

          <div ref={messagesRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {messages.map((m) => (
              <div key={m.id} className={m.sender === 'customer' ? 'text-end' : 'text-start'}>
                <span
                  dir="auto"
                  className={`inline-block max-w-[85%] whitespace-pre-line break-words rounded-card px-3 py-2 text-start leading-snug ${
                    m.sender === 'customer'
                      ? 'bg-white text-brand-navy'
                      : m.escalated
                        ? 'border border-gold-500/40 bg-gold-500/10 text-gold-300'
                        : 'bg-navy-700 text-white'
                  }`}
                >
                  {m.sender === 'customer' ? m.text : linkifyPaths(taeboText(m, t))}
                </span>
                {m.escalated && m.noticeKey === 'account' && (
                  <Link href="/account/orders" className="mt-1 block text-xs text-brand-gold underline">
                    {t('taebo.quick.ordersDownloads')}
                  </Link>
                )}
                {m.options && m.options.length > 0 && (
                  <div className="mt-1.5 space-y-1.5">
                    {m.options.map((o) => (
                      <button
                        key={o.faqId}
                        dir="auto"
                        onClick={() => void send(o.question)}
                        className="block w-full rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-start text-brand-silver transition-colors hover:border-brand-gold hover:text-white"
                      >
                        {o.question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {onlyGreeting && (
              <div className="space-y-1.5">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-gold/80">{t('taebo.quickActions')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-brand-silver transition-colors hover:border-brand-gold hover:text-white"
                    >
                      {action.label === 'Vector Art' ? action.label : t(action.label)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {onlyGreeting && suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-gold/80">{t('taebo.commonQuestions')}</p>
                {suggestions.map((s) => (
                  <button
                    key={s.faqId}
                    dir="auto"
                    onClick={() => void send(s.question)}
                    className="block w-full rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-start text-brand-silver transition-colors hover:border-brand-gold hover:text-white"
                  >
                    {s.question}
                  </button>
                ))}
              </div>
            )}
            {/* §27 — a professional dot-typing indicator rather than a text line; the sr-only text
                keeps it announced to screen readers, and the dots hold still under reduced-motion. */}
            {loading && (
              <div className="flex items-center gap-1 px-1" role="status">
                <span className="sr-only">{t('taebo.typing')}</span>
                <span className="taebo-typing-dot h-1.5 w-1.5 rounded-full bg-brand-silver/60" />
                <span className="taebo-typing-dot h-1.5 w-1.5 rounded-full bg-brand-silver/60" style={{ animationDelay: '0.15s' }} />
                <span className="taebo-typing-dot h-1.5 w-1.5 rounded-full bg-brand-silver/60" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
            {error && (
              <div className="space-y-1.5 rounded-field border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-200">
                <p>{t('taebo.connectionError')}</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => failedText && void send(failedText, true)} className="font-medium underline">
                    {t('common.retry')}
                  </button>
                  <Link href="/contact" className="font-medium underline">
                    {t('taebo.contactSupport')}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-2">
            {/* A-025 — the explicit hand-off from the AI assistant to a person (spec §8.3). Taebo's own
                answering/escalation above is unchanged. */}
            {(!user || user.role === 'customer') && (
              <Link
                href={user ? '/account/support/new' : `/login?next=${encodeURIComponent('/account/support/new')}`}
                onClick={() => setOpen(false)}
                className="mb-2 flex items-center justify-center rounded-field border border-brand-gold/50 py-1.5 text-xs font-semibold text-brand-gold hover:bg-white/5"
              >
                {t('supportChat.chatWithPerson')}
              </Link>
            )}
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="mb-2 block text-center text-xs text-emerald-400 underline">
                {t('taebo.whatsapp')}
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
                placeholder={t('taebo.inputPlaceholder')}
                aria-label={t('taebo.inputPlaceholder')}
                className="flex-1 rounded-field border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-brand-silver/50 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-field bg-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-navy transition hover:brightness-105 disabled:opacity-50"
              >
                {t('taebo.send')}
              </button>
            </form>
            {/* Part 12 — a simple, always-available way back to the default corner; keyboard-reachable
                like every other control here, so dragging never traps a keyboard user. */}
            <button
              type="button"
              onClick={resetPosition}
              className="mt-1.5 w-full text-center text-[11px] text-brand-silver/50 hover:text-brand-gold hover:underline"
            >
              {t('taebo.resetPosition')}
            </button>
          </div>
        </div>
      )}

      {/* The floating launcher — the realistic full-body panda itself, not cropped into a circular
          avatar/generic chatbot icon (design system §"TAEBO" / spec §10.1). Draggable (mouse +
          touch, via pointer events) with a small movement threshold so a plain click still opens
          chat (Part 6). Always a real <button> with no visible background chrome of its own — just
          the character plus a drop-shadow for grounding: Enter/Space activates it exactly like a
          click, with no drag involved, so keyboard users are never required to drag (Part 15's
          accessible-alternative requirement); the focus ring below shows keyboard focus without
          needing a permanent circular/boxed background. */}
      {!open && (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onLauncherPointerUp}
          onClick={onLauncherClick}
          aria-label={t('taebo.open')}
          className="taebo-motion-safe group fixed z-50 inline-flex h-[90px] touch-none items-end justify-center rounded-lg transition-all duration-500 ease-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 sm:h-32"
          style={{
            ...launcherStyle,
            transform: scrolledIn ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.6)',
            opacity: scrolledIn ? 1 : 0,
          }}
        >
          <TaeboPanda
            variant="full"
            pose={pose}
            waving={pose === 'idle' || pose === 'greeting'}
            className="pointer-events-none h-full w-auto transition-transform duration-300 group-hover:-translate-y-0.5"
          />
        </button>
      )}
    </>
  );
}
