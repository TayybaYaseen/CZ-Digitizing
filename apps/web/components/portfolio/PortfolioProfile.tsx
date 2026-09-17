import { portfolioProfileContent } from '@/lib/portfolio-profile-content';
import { PortfolioSectionHeading } from './PortfolioSectionHeading';

// docs/portfolio-spec.md §5.2 — the merged profile paragraph (§10.2), embroidery-led with
// textile/sourcing background named as real, secondary experience.
export function PortfolioProfile() {
  return (
    <section className="mx-auto max-w-3xl px-1">
      <PortfolioSectionHeading eyebrow="Professional Profile" title="About" />
      <p className="text-sm leading-relaxed text-gray-700 sm:text-base">{portfolioProfileContent.profile.text}</p>
    </section>
  );
}
