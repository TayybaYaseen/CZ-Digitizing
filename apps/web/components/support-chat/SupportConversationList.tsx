'use client';

import Link from 'next/link';
import type { SupportConversationSummaryDto } from '@czd/shared-types';
import { useLocale } from '@/lib/locale-context';
import { contextLabel } from '@/lib/support-chat';

interface Props {
  conversations: SupportConversationSummaryDto[] | null;
  selectedId: string | null;
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §8.2 — the customer's own conversations,
// newest activity first, with context, last-message preview, time and unread count.
export function SupportConversationList({ conversations, selectedId }: Props) {
  const { t, formatDate } = useLocale();

  if (conversations === null) {
    return (
      <ul className="divide-y divide-gray-100" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="space-y-2 px-4 py-3">
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        <p>{t('supportChat.empty')}</p>
        <Link href="/account/support/new" className="mt-3 inline-block font-medium text-brand-navy underline">
          {t('supportChat.startConversation')}
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {conversations.map((c) => {
        const selected = c.id === selectedId;
        const unread = c.unreadCount > 0;
        const preview = c.lastMessagePreview ? (c.lastMessageFromMe ? t('supportChat.lastFromYou', { text: c.lastMessagePreview }) : c.lastMessagePreview) : '';
        return (
          <li key={c.id}>
            <Link
              href={`/account/support/${c.id}`}
              aria-current={selected ? 'page' : undefined}
              className={`block px-4 py-3 hover:bg-gray-50 ${selected ? 'bg-brand-gold/10' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm ${unread ? 'font-bold' : 'font-medium'} text-brand-navy`}>
                  <bdi>{contextLabel(t, c.context)}</bdi>
                </span>
                <time dateTime={c.lastMessageAt} className="flex-shrink-0 text-xs text-gray-500">
                  {formatDate(c.lastMessageAt, { dateStyle: 'short' })}
                </time>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span dir="auto" className={`truncate text-xs ${unread ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                  {preview}
                </span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  {c.isResolved && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{t('supportChat.resolved')}</span>}
                  {unread && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
                      <span aria-hidden="true">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>
                      <span className="sr-only">{t('supportChat.unread', { count: c.unreadCount })}</span>
                    </span>
                  )}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
