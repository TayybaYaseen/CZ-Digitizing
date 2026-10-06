'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SUPPORT_CHAT_NAMESPACE, type SupportContextRefDto } from '@czd/shared-types';
import { apiFetch, getFreshAccessToken } from './api-client';
import { API_URL } from './api-url';
import type { TranslationValues } from '@/i18n/translate';
import type { TranslationKey } from './locale-context';

// Customer ↔ Admin Live Chat (aspect A-025) — docs/specs/2026-10-06-21-customer-admin-live-chat.md.
// Shared client plumbing for the /account/support pages and the account-menu badge.

export function authHeaders(accessToken: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function newClientMessageId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // RFC 4122 v4 fallback for older browsers without crypto.randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type Translate = (key: TranslationKey, values?: TranslationValues) => string;

const CONTEXT_KEYS = {
  order: 'supportChat.contextOrder',
  custom_request: 'supportChat.contextCustomRequest',
  quote: 'supportChat.contextQuote',
  file_format_request: 'supportChat.contextFileFormatRequest',
} as const satisfies Record<Exclude<SupportContextRefDto['type'], 'general'>, TranslationKey>;

// "Order #1234" / "General support" — composed through i18n, never by the API (§10.3).
export function contextLabel(t: Translate, context: SupportContextRefDto): string {
  if (context.type === 'general') return t('supportChat.general');
  const label = t(CONTEXT_KEYS[context.type], { id: context.label ?? '' });
  // The record was deleted after the conversation started (ON DELETE SET NULL, §19.1).
  if (context.id) return label;
  // No number left to show: drop the dangling "#" / "n°" marker before adding "(no longer available)".
  return t('supportChat.contextUnavailable', { label: label.replace(/s*(#|n°|nº|№)?s*$/u, '') });
}

// ---- Unread badge (§11.10): the existing 30s polling cycle, plus instant updates from the chat pages ----

type UnreadListener = (total: number) => void;
const unreadListeners = new Set<UnreadListener>();

export function publishSupportUnread(total: number): void {
  unreadListeners.forEach((listener) => listener(total));
}

const POLL_INTERVAL_MS = 30_000;

export function useSupportUnreadCount(accessToken: string | null, enabled: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled || !accessToken) {
      setTotal(0);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const res = await apiFetch<{ total: number }>('/api/support/unread-count', { headers: authHeaders(accessToken) });
        if (!cancelled) setTotal(res.total);
      } catch {
        // keep the last-known value, same as NotificationBell
      }
    }
    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, enabled]);

  useEffect(() => {
    const listener: UnreadListener = (next) => setTotal(next);
    unreadListeners.add(listener);
    return () => {
      unreadListeners.delete(listener);
    };
  }, []);

  return total;
}

// ---- Socket (§11.3, §11.7) ----

// One socket per chat page. Pushes only — every write is a REST call, so a dropped socket never loses
// a message; the caller gap-fills with `after=` on every (re)connect.
export function useSupportSocket(enabled: boolean): { socket: Socket | null; connected: boolean } {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const s = io(`${API_URL}${SUPPORT_CHAT_NAMESPACE}`, {
      // WebSocket only: no long-polling fallback, so no cross-origin XHR to the API (the server checks
      // the Origin header against its allowlist during the handshake instead).
      transports: ['websocket'],
      // Called on every (re)connect, so a reconnect always presents a fresh token (§11.3).
      auth: (cb) => {
        void getFreshAccessToken().then((token) => cb({ token: token ?? '' }));
      },
    });

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    // socket.io doesn't auto-reconnect after a server-side disconnect (token expiry) or a handshake
    // rejection, so those retry here with backoff; the auth callback above supplies a fresh token.
    const retry = () => {
      if (s.active) return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => s.connect(), Math.min(30_000, 1000 * 2 ** attempts++));
    };

    s.on('connect', () => {
      attempts = 0;
      setConnected(true);
    });
    s.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') retry();
    });
    s.on('connect_error', () => {
      setConnected(false);
      retry();
    });
    setSocket(s);

    return () => {
      clearTimeout(retryTimer);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [enabled]);

  return { socket, connected };
}

// Splits plain text into text and http(s) link parts (§14.1) — nothing else is ever interpreted.
export function linkify(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = /https?:\/\/[^\s<>"']+/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    let url = match[0];
    // Trailing punctuation usually belongs to the sentence, not the URL.
    const trailing = /[.,!?;:)\]]+$/.exec(url)?.[0] ?? '';
    url = url.slice(0, url.length - trailing.length);
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
