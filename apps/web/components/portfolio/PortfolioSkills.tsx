import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

// docs/portfolio-spec.md §5.8 — the 7-item union list (§2.4 row 2).
export function PortfolioSkills() {
  return (
    <section className="mx-auto max-w-3xl px-1">
      <PortfolioSectionHeading title="Key Skills" weight="secondary" />
      <ul className="flex flex-wrap gap-2">
        {portfolioProfileContent.keySkills.map((skill) => (
          <li key={skill} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-navy shadow-cz-sm sm:text-sm">
            {skill}
          </li>
        ))}
      </ul>
    </section>
  );
}
