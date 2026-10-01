import type { Metadata } from 'next';
import { getServerTranslator } from '@/i18n/server';
import { portfolioProfileContent } from '@/lib/portfolio-profile-content';

// docs/portfolio-spec.md §13 — Portfolio-scoped metadata only. apps/web has no other
// generateMetadata usage (root layout.tsx sets one static site-wide title/description that every
// other route silently inherits) — this file is additive and does not touch that root layout or
// any other route. i18n (A-021): the "Portfolio" label follows the visitor's locale; the CV-derived
// name/descriptor are source content and stay as written.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return {
    title: `${portfolioProfileContent.identity.name} — ${t('nav.portfolio')} | CZ Digitizing`,
    description: `${portfolioProfileContent.identity.descriptor}. ${portfolioProfileContent.coreEmbroideryExpertise.summary}`,
  };
}

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
