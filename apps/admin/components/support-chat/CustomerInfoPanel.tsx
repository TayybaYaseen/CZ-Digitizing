'use client';

import Link from 'next/link';
import type { AdminSupportConversationDto } from '@czd/shared-types';
import { contextLabel } from '@/lib/support-chat';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', nl: 'Dutch', tr: 'Turkish',
  ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian', hi: 'Hindi', ur: 'Urdu',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-xs">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 truncate text-end font-medium text-gray-800">{children}</dd>
    </div>
  );
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §18/§19 — who the customer is and what the
// conversation is about. Deep links go to the full records, which enforce their own permissions.
export function CustomerInfoPanel({ detail }: { detail: AdminSupportConversationDto }) {
  const c = detail.customerInfo;
  const card = detail.contextCard;
  return (
    <div className="space-y-5 p-4">
      <section aria-labelledby="support-customer-heading">
        <h3 id="support-customer-heading" className="text-sm font-semibold text-navy-800">
          {c.displayName ?? c.username ?? c.email}
        </h3>
        <dl className="mt-2 divide-y divide-gray-100">
          <Row label="Email">
            <span dir="ltr">{c.email}</span>
          </Row>
          {c.phone && (
            <Row label="Phone">
              <span dir="ltr">{c.phone}</span>
            </Row>
          )}
          <Row label="Language">{c.preferredLocale ? (LANGUAGE_NAMES[c.preferredLocale] ?? c.preferredLocale) : 'Not set'}</Row>
          <Row label="Customer since">{new Date(c.memberSince).toLocaleDateString()}</Row>
          <Row label="Account">{c.accountStatus}</Row>
          <Row label="Orders">{c.counts.orders}</Row>
          <Row label="Custom requests">{c.counts.customRequests}</Row>
          <Row label="Quotes">{c.counts.quotes}</Row>
          <Row label="Open conversations">{c.counts.openConversations}</Row>
        </dl>
        <Link href={c.adminProfileHref} className="mt-2 inline-block text-xs font-semibold text-gold-700 underline">
          Open customer record ↗
        </Link>
      </section>

      {card && (
        <section aria-labelledby="support-context-heading" className="rounded-lg border border-gray-200 p-3">
          <h3 id="support-context-heading" className="text-sm font-semibold text-navy-800">
            {contextLabel(detail.context)}
          </h3>
          {card.available ? (
            <>
              <dl className="mt-2 divide-y divide-gray-100">
                {card.status && <Row label="Status">{card.status.replace(/_/g, ' ')}</Row>}
                {card.paymentStatus && <Row label="Payment">{card.paymentStatus.replace(/_/g, ' ')}</Row>}
                {card.totalPkr && <Row label="Total">PKR {card.totalPkr}</Row>}
                {card.reference && <Row label={card.type === 'file_format_request' ? 'Format' : 'Reference'}>{card.reference}</Row>}
                {card.createdAt && <Row label="Created">{new Date(card.createdAt).toLocaleDateString()}</Row>}
              </dl>
              {card.adminHref && (
                <Link href={card.adminHref} className="mt-2 inline-block text-xs font-semibold text-gold-700 underline">
                  Open record ↗
                </Link>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-gray-500">This record no longer exists. The conversation is kept.</p>
          )}
        </section>
      )}
    </div>
  );
}
