'use client';

import { useEffect, useState } from 'react';
import type { PublicTestimonialDto } from '@czd/shared-types';
import { useLocale } from '@/lib/locale-context';

// Shared by apps/web/app/testimonials/page.tsx and components/HomeTestimonials.tsx — split out
// of testimonials/page.tsx because Next.js App Router forbids a page.tsx file from exporting
// anything besides `default` (and a small set of special names); a named export there fails
// `next build`'s route type-check even though `tsc --noEmit` doesn't catch it.
//
// A-026 (docs/specs/2026-10-06-22-customer-review-submission.md §14): renders only public fields;
// the customer's photo (imageUrl) appears only because the API returns it for published reviews.
export function TestimonialCard({ t: item }: { t: PublicTestimonialDto }) {
  const { t, formatDate } = useLocale();
  const [viewing, setViewing] = useState(false);
  const photoAlt = t('reviews.photoBy', { name: item.customerName });

  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt={item.customerName} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-sm font-semibold text-gold-700">
            {item.customerName.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p dir="auto" className="break-words text-sm font-semibold text-brand-navy">{item.customerName}</p>
          {(item.country || item.business) && (
            <p dir="auto" className="break-words text-xs text-gray-500">
              {[item.country, item.business].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-gold-600" role="img" aria-label={t('reviews.starsLabel', { count: item.rating })}>
        {'★'.repeat(item.rating)}
        {'☆'.repeat(5 - item.rating)}
      </p>
      <p dir="auto" className="mt-2 whitespace-pre-line break-words text-sm text-gray-700">{item.feedback}</p>
      {item.imageUrl && (
        <button type="button" onClick={() => setViewing(true)} className="mt-3 block w-full overflow-hidden rounded-md border border-gray-100" aria-label={t('reviews.viewPhoto')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={photoAlt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </button>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 pt-2 text-xs text-gray-400">
        <p dir="auto" className="font-medium">{item.serviceUsed}</p>
        <p>{formatDate(item.createdAt, { year: 'numeric', month: 'long' })}</p>
      </div>
      {viewing && item.imageUrl && <PhotoViewer src={item.imageUrl} alt={photoAlt} onClose={() => setViewing(false)} />}
    </div>
  );
}

function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useLocale();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} autoFocus className="absolute end-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-brand-navy">
        {t('common.close')}
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
