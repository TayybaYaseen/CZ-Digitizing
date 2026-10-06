import { SUPPORT_MESSAGE_MAX_LENGTH, SUPPORT_PREVIEW_LENGTH } from './support-chat.constants';

// C0/C1 control characters except \t (0x09) and \n (0x0A). \r is handled first (CRLF → LF).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INVISIBLE_ONLY = /^[\s​-‍⁠﻿]*$/;

export type NormalizedBody = { ok: true; body: string } | { ok: false; reason: 'empty' | 'too_long' };

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §28.4 — the one place a message body is cleaned
// before it is stored. Output is always rendered as plain text by the clients; nothing here tries to
// "sanitize HTML" because no HTML is ever interpreted.
export function normalizeSupportMessageBody(raw: string): NormalizedBody {
  let body = raw.normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '');
  // More than two consecutive blank lines collapse to two.
  body = body.replace(/\n{4,}/g, '\n\n\n').trim();
  if (INVISIBLE_ONLY.test(body)) return { ok: false, reason: 'empty' };
  // UTF-16 length, matching the browser's textarea maxLength — always ≥ Postgres char_length, so the
  // DB CHECK (char_length ≤ 4000) can never reject what this accepted.
  if (body.length > SUPPORT_MESSAGE_MAX_LENGTH) return { ok: false, reason: 'too_long' };
  return { ok: true, body };
}

// List-row / notification preview: single line, at most SUPPORT_PREVIEW_LENGTH characters including
// the ellipsis, never cutting a surrogate pair in half.
export function supportMessagePreview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  if (chars.length <= SUPPORT_PREVIEW_LENGTH) return flat;
  return `${chars.slice(0, SUPPORT_PREVIEW_LENGTH - 1).join('').trimEnd()}…`;
}
