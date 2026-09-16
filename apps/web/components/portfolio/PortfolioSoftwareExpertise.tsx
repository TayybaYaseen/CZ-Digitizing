import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

// docs/portfolio-spec.md §5.4 — Wilcom/Pulse Tajima given large, top billing (primary); Oracle ERP
// and MS Office as a smaller "also proficient in" line beneath (secondary) — one section,
// internally hierarchical, rather than a second separate software section.
export function PortfolioSoftwareExpertise() {
  const { softwareExpertise } = portfolioProfileContent;

  return (
    <section className="mx-auto max-w-4xl px-1">
      <PortfolioSectionHeading eyebrow="Software Expertise" title="Embroidery Software" weight="primary" />
      <div className="grid gap-4 sm:grid-cols-2">
        {softwareExpertise.primary.map((name) => (
          <div key={name} className="rounded-card border border-gray-200 bg-white p-5 shadow-cz-sm">
            <p className="font-display text-lg font-bold text-brand-navy">{name}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">Also proficient in</p>
      <p className="mt-1 text-sm text-gray-600">{softwareExpertise.secondary.join(' · ')}</p>
    </section>
  );
}
