import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

// docs/portfolio-spec.md §5.9 — published entries only (the MBA is presented as completed, §2.4
// row 13); no "ongoing"/"continue"/"last semester" wording anywhere here.
export function PortfolioEducation() {
  return (
    <section className="mx-auto max-w-3xl px-1">
      <PortfolioSectionHeading title="Education" weight="secondary" />
      <ul className="space-y-3">
        {portfolioProfileContent.education.published.map((entry) => (
          <li key={entry.credential} className="rounded-card border border-gray-200 bg-white p-4 shadow-cz-sm">
            <p className="font-display text-base font-bold text-brand-navy">{entry.credential}</p>
            <p className="text-sm text-gray-600">{entry.institution}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">{entry.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
