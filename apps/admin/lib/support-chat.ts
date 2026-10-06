'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SUPPORT_CHAT_NAMESPACE, type SupportContextRefDto, type SupportConversationStatus } from '@czd/shared-types';
import { apiFetch, getFreshAccessToken } from './api-client';
import { API_URL } from './api-url';

// Admin → Customer Support → Live Chat (aspect A-025) — docs/specs/2026-10-06-21-customer-admin-live-chat.md.

export function authHeaders(accessToken: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

interface TokenClaims {
  role?: string;
  permissions?: string[];
}

function claimsOf(accessToken: string | null): TokenClaims {
  if (!accessToken) return {};
  try {
    return JSON.parse(atob((accessToken.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as TokenClaims;
  } catch {
    return {};
  }
}

// Mirrors the API's rule (§12): role=admin always; freelancer/moderator need the support_chat module.
// Only decides what the UI shows/polls — every route and socket join is still checked server-side.
export function supportAccess(accessToken: string | null): { canRead: boolean; canReply: boolean } {
  const { role, permissions = [] } = claimsOf(accessToken);
  if (role === 'admin') return { canRead: true, canReply: true };
  return {
    canRead: permissions.includes('support_chat:read_only') || permissions.includes('support_chat:crud'),
    canReply: permissions.includes('support_chat:crud'),
  };
}

export function newClientMessageId(): string {
  return crypto.randomUUID();
}

export const STATUS_LABEL: Record<SupportConversationStatus, string> = { open: 'Open', pending: 'Pending', resolved: 'Resolved' };
export const STATUS_TONE: Record<SupportConversationStatus, 'gold' | 'neutral' | 'success'> = { open: 'gold', pending: 'neutral', resolved: 'success' };

const CONTEXT_NOUN: Record<Exclude<SupportContextRefDto['type'], 'general'>, string> = {
  order: 'Order',
  custom_request: 'Custom request',
  quote: 'Quote',
  file_format_request: 'Format request',
};

export function contextLabel(context: SupportContextRefDto): string {
  if (context.type === 'general') return 'General';
  const noun = CONTEXT_NOUN[context.type];
  return context.id ? `${noun} #${context.label ?? context.id}` : `${noun} (no longer available)`;
}

// ---- Sidebar badge (§11.10): existing 30s polling cycle + instant updates from the Live Chat page ----

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function publishStaffUnread(count: number): void {
  listeners.forEach((l) => l(count));
}

export function useStaffUnreadConversations(accessToken: string | null): number {
  const [count, setCount] = useState(0);
  const { canRead } = supportAccess(accessToken);

  useEffect(() => {
    // Never poll without access: each 403 would write an ACCESS_DENIED audit row every 30s.
    if (!accessToken || !canRead) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await apiFetch<{ conversations: number }>('/api/admin/support/unread-count', { headers: authHeaders(accessToken) });
        if (!cancelled) setCount(res.conversations);
      } catch {
        // keep last-known value
      }
    }
    void poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, canRead]);

  useEffect(() => {
    const l: Listener = (n) => setCount(n);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return count;
}

// ---- Socket (§11.3, §11.7) — pushes only; every write is a REST call ----

export function useSupportSocket(enabled: boolean): { socket: Socket | null; connected: boolean } {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const s = io(`${API_URL}${SUPPORT_CHAT_NAMESPACE}`, {
      transports: ['websocket'],
      auth: (cb) => {
        void getFreshAccessToken().then((token) => cb({ token: token ?? '' }));
      },
    });
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    // socket.io won't auto-reconnect after a server-side disconnect (token expiry) or a rejected
    // handshake; retry with backoff — the auth callback supplies a fresh token each time.
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

export function linkify(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const start = match.index ?? 0;
    const trailing = /[.,!?;:)\]]+$/.exec(match[0])?.[0] ?? '';
    const url = match[0].slice(0, match[0].length - trailing.length);
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
