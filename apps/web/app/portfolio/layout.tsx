import type { Metadata } from 'next';
import { portfolioProfileContent } from '@/lib/portfolio-profile-content';

// docs/portfolio-spec.md §13 — Portfolio-scoped metadata only. apps/web has no other
// generateMetadata usage (root layout.tsx sets one static site-wide title/description that every
// other route silently inherits) — this file is additive and does not touch that root layout or
// any other route.
export const metadata: Metadata = {
  title: `${portfolioProfileContent.identity.name} — Portfolio | CZ Digitizing`,
  description: `${portfolioProfileContent.identity.descriptor}. ${portfolioProfileContent.coreEmbroideryExpertise.summary}`,
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
