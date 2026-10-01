'use client';

import { useState } from 'react';
import { useLocale } from '@/lib/locale-context';
import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

const COLLAPSED_COUNT = 6;

// docs/portfolio-spec.md §5.5/§7, revised 2026-09-18 — a single consolidated "Freelancer" entry,
// no employer names or per-employer responsibility lists. The expand control (§14's real
// <button aria-expanded>, not a bare <div onClick>) is kept for any future entry long enough to
// need it, though the current single entry stays under the collapse threshold.
function ExperienceCard({ employer, title, dates, bullets }: { employer: string; title: string; dates: string; bullets: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLocale();
  const needsToggle = bullets.length > COLLAPSED_COUNT;
  const visible = needsToggle && !expanded ? bullets.slice(0, COLLAPSED_COUNT) : bullets;

  return (
    <div className="rounded-card border border-gray-200 bg-white p-6 shadow-cz-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-xl font-bold text-brand-navy">{employer}</h3>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{dates}</span>
      </div>
      <p className="mt-0.5 text-sm font-semibold text-gold-600">{title}</p>
      <ul className="mt-4 list-disc space-y-2 ps-5 text-sm leading-relaxed text-gray-700">
        {visible.map((bullet, i) => (
          <li key={i} dir="auto">{bullet}</li>
        ))}
      </ul>
      {needsToggle && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 text-sm font-semibold text-brand-navy underline underline-offset-2 hover:text-gold-600"
        >
          {expanded ? t('common.showLess') : t('portfolio.showAllResponsibilities', { count: bullets.length })}
        </button>
      )}
    </div>
  );
}

export function PortfolioExperience() {
  const { t } = useLocale();
  return (
    <section className="mx-auto max-w-4xl px-1">
      <PortfolioSectionHeading eyebrow={t('portfolio.experienceEyebrow')} title={t('portfolio.experienceTitle')} weight="primary" />
      <div className="space-y-5">
        {portfolioProfileContent.experience.map((entry) => (
          <ExperienceCard key={entry.employer} employer={entry.employer} title={entry.title} dates={entry.dates} bullets={[...entry.bullets]} />
        ))}
      </div>
    </section>
  );
}
