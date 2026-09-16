import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

// docs/portfolio-spec.md §5.3 — the dominant, primary-weight expertise section. A synthesized
// capability summary, not a bullet reproduction: full per-employer detail lives in
// PortfolioExperience (§5.5) so the same content isn't shown twice.
export function PortfolioCoreExpertise() {
  const { coreEmbroideryExpertise } = portfolioProfileContent;

  return (
    <section className="mx-auto max-w-4xl px-1">
      <PortfolioSectionHeading eyebrow="Core Expertise" title="Embroidery & Digitizing Expertise" weight="primary" />
      <p className="max-w-2xl text-sm leading-relaxed text-gray-700 sm:text-base">{coreEmbroideryExpertise.summary}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {coreEmbroideryExpertise.highlights.map((h) => (
          <li key={h} className="rounded-full border border-gold-300 bg-gold-100 px-3.5 py-1.5 text-xs font-semibold text-brand-navy sm:text-sm">
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
}
