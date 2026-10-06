'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/lib/locale-context';

const MAX_LENGTH = 4000; // SUPPORT_MESSAGE_MAX_LENGTH (spec §14.1)
const COUNTER_FROM = 3500;
const MAX_ROWS = 5;

interface Props {
  // Return a promise resolving to false to put the text back (e.g. a failed start, where no
  // "Not sent · Retry" bubble exists to hold it).
  onSend: (body: string) => void | Promise<boolean>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: string | null;
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2/§23 — multiline composer. Enter sends on
// devices with a fine pointer; on touch devices Enter is a newline and only the Send button sends.
export function SupportComposer({ onSend, onTyping, disabled, autoFocus, error }: Props) {
  const { t } = useLocale();
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef<{ active: boolean; lastSent: number; idleTimer?: ReturnType<typeof setTimeout> }>({ active: false, lastSent: 0 });
  const coarsePointer = useRef(false);

  useEffect(() => {
    coarsePointer.current = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    // Desktop only: focusing on mobile would pop the keyboard open uninvited (§27).
    if (autoFocus && !coarsePointer.current) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => () => clearTimeout(typingRef.current.idleTimer), []);

  // Grow with the content up to MAX_ROWS lines, then scroll inside the textarea.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * MAX_ROWS + 16)}px`;
  }, [value]);

  function signalTyping(next: string) {
    if (!onTyping) return;
    const state = typingRef.current;
    clearTimeout(state.idleTimer);
    if (!next.trim()) {
      if (state.active) onTyping(false);
      state.active = false;
      return;
    }
    // At most one "typing" every 3s while typing (§31); "stopped" after 4s idle.
    if (!state.active || Date.now() - state.lastSent > 3000) {
      onTyping(true);
      state.active = true;
      state.lastSent = Date.now();
    }
    state.idleTimer = setTimeout(() => {
      state.active = false;
      onTyping(false);
    }, 4000);
  }

  function submit() {
    const body = value.trim();
    if (!body || disabled || value.length > MAX_LENGTH) return;
    const result = onSend(body);
    setValue('');
    if (result instanceof Promise) void result.then((ok) => !ok && setValue((current) => current || body));
    clearTimeout(typingRef.current.idleTimer);
    if (typingRef.current.active) onTyping?.(false);
    typingRef.current.active = false;
    ref.current?.focus();
  }

  const remaining = MAX_LENGTH - value.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-gray-200 bg-white p-3"
    >
      {error && (
        <p role="alert" className="mb-2 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <label htmlFor="support-composer" className="sr-only">
          {t('supportChat.messageLabel')}
        </label>
        <textarea
          id="support-composer"
          ref={ref}
          rows={1}
          dir="auto"
          value={value}
          maxLength={MAX_LENGTH}
          placeholder={t('supportChat.placeholder')}
          onChange={(e) => {
            setValue(e.target.value);
            signalTyping(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !coarsePointer.current && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="min-h-[44px] flex-1 resize-none rounded-field border border-gray-300 px-3 py-2.5 text-base leading-5 text-brand-navy focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy sm:text-sm"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-field bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-navyLight disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('supportChat.send')}
        </button>
      </div>
      {value.length >= COUNTER_FROM && (
        <p className={`mt-1 text-end text-xs ${remaining < 100 ? 'text-red-600' : 'text-gray-500'}`} aria-live="polite">
          {t('supportChat.charactersLeft', { count: remaining })}
        </p>
      )}
    </form>
  );
}
