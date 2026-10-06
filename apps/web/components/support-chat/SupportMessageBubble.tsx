'use client';

import type { ReactNode } from 'react';
import { useLocale } from '@/lib/locale-context';
import { linkify } from '@/lib/support-chat';

interface Props {
  own: boolean;
  body: string;
  createdAt: string | null;
  footer?: ReactNode;
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2/§14.1/§26/§27 — plain text only (React
// escapes it), line breaks kept, http(s) links auto-linked. The customer's own messages sit on the
// end side and Support's on the start side, so the layout mirrors in Arabic/Urdu; `dir="auto"` lets
// an English message read LTR inside an RTL page (and vice versa).
export function SupportMessageBubble({ own, body, createdAt, footer }: Props) {
  const { t, formatDate } = useLocale();
  const time = createdAt ? formatDate(createdAt, { hour: 'numeric', minute: '2-digit' }) : '';
  const sender = own ? t('supportChat.you') : t('supportChat.teamName');

  return (
    <div className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[75%] ${
          own ? 'rounded-ee-md bg-brand-navy text-white' : 'rounded-es-md border border-gray-200 bg-white text-brand-navy'
        }`}
      >
        <span className="sr-only">{t('supportChat.messageFrom', { sender, time, text: '' })}</span>
        <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {linkify(body).map((part, i) =>
            part.href ? (
              <a
                key={i}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className={`underline ${own ? 'text-brand-gold' : 'text-brand-navy'}`}
              >
                {part.text}
              </a>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
      </div>
      <p className="mt-0.5 px-1 text-[11px] text-gray-500">
        {/* <bdi>: a Latin "7:56 PM" inside an Arabic/Urdu line would otherwise reorder to "PM 7:56". */}
        {time && (
          <bdi>
            <time dateTime={createdAt ?? undefined}>{time}</time>
          </bdi>
        )}
        {time && footer ? ' · ' : null}
        {footer}
      </p>
    </div>
  );
}
