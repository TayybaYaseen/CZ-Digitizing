'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/locale-context';

// SRS §6 — Embroidery Digitizing / Vector Art service highlight. TODO(A-014): the Services Module
// itself is still Blocked (SPEC_INDEX.md), so these cards link to /services which 404s for now,
// same posture as Header.tsx's existing Services nav link. Always renders (AC-8 empty-state floor).
// i18n (A-021): client component so it switches language together with the rest of the page.
export function ServicesSummary() {
  const { t } = useLocale();
  const services = [
    { title: t('services.embroideryDigitizing'), description: t('home.services.digitizingDescription') },
    // "Vector Art" is a service brand name and stays untranslated in every locale.
    { title: 'Vector Art', description: t('home.services.vectorDescription') },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-center font-display text-xl font-bold text-brand-navy">{t('home.services.title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <Link
            key={s.title}
            href="/services"
            className="rounded-card border border-gray-200 bg-white p-6 text-center shadow-cz-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-cz-md"
          >
            <h3 className="font-display text-lg font-semibold text-brand-navy">{s.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{s.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
