'use client';

import { useState } from 'react';
import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

// docs/portfolio-spec.md §5.10 — Nagina Group internship, included per business-owner decision
// (§2.4 row 11), rendered visibly smaller/lighter than PortfolioExperience (§5.5), undated by
// design rather than assigned invented dates.
export function PortfolioAdditionalExperience() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mx-auto max-w-3xl px-1">
      <PortfolioSectionHeading title="Earlier Experience" weight="secondary" />
      {portfolioProfileContent.additionalExperience.map((entry) => (
        <div key={entry.employer} className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-sm font-bold text-gray-600">{entry.employer}</p>
            <span className="text-xs uppercase tracking-wide text-gray-400">{entry.dates}</span>
          </div>
          <p className="text-xs font-semibold text-gray-500">{entry.title}</p>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs font-semibold text-brand-navy underline underline-offset-2 hover:text-gold-600"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
          {expanded && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-gray-600">
              {entry.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
