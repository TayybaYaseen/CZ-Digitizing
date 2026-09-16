'use client';

import { useState } from 'react';
import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

const COLLAPSED_COUNT = 5;

// docs/portfolio-spec.md §5.6 — secondary-weight section: real, full content (§2.4 row 10), never
// trimmed for space, but visibly smaller scale than §5.3–§5.5's embroidery content (§7).
export function PortfolioTextileExpertise() {
  const { textileSourcingExpertise } = portfolioProfileContent;
  const [expanded, setExpanded] = useState(false);
  const bullets = textileSourcingExpertise.bullets;
  const needsToggle = bullets.length > COLLAPSED_COUNT;
  const visible = needsToggle && !expanded ? bullets.slice(0, COLLAPSED_COUNT) : bullets;

  return (
    <section className="mx-auto max-w-3xl px-1">
      <PortfolioSectionHeading eyebrow="Secondary Expertise" title="Textile & Sourcing Expertise" weight="secondary" />
      <div className="rounded-card border border-gray-200 bg-brand-lightGray/40 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-lg font-bold text-brand-navy">{textileSourcingExpertise.employer}</h3>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{textileSourcingExpertise.dates}</span>
        </div>
        <p className="mt-0.5 text-sm font-semibold text-gray-500">{textileSourcingExpertise.title}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-600">
          {visible.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
        {needsToggle && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 text-xs font-semibold text-brand-navy underline underline-offset-2 hover:text-gold-600"
          >
            {expanded ? 'Show less' : `Show all ${bullets.length} responsibilities`}
          </button>
        )}
      </div>
    </section>
  );
}
