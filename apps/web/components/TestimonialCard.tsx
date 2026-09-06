import type { TestimonialDto } from '@czd/shared-types';

// Shared by apps/web/app/testimonials/page.tsx and components/HomeTestimonials.tsx — split out
// of testimonials/page.tsx because Next.js App Router forbids a page.tsx file from exporting
// anything besides `default` (and a small set of special names); a named export there fails
// `next build`'s route type-check even though `tsc --noEmit` doesn't catch it.
export function TestimonialCard({ t }: { t: TestimonialDto }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        {t.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.photoUrl} alt={t.customerName} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-100 text-sm font-semibold text-gold-700">
            {t.customerName.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-brand-navy">{t.customerName}</p>
          <p className="text-xs text-gray-500">
            {t.country}
            {t.business ? ` · ${t.business}` : ''}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gold-600">
        {'★'.repeat(t.rating)}
        {'☆'.repeat(5 - t.rating)}
      </p>
      <p className="mt-2 text-sm text-gray-700">{t.feedback}</p>
      <p className="mt-2 text-xs font-medium text-gray-400">{t.serviceUsed}</p>
    </div>
  );
}
