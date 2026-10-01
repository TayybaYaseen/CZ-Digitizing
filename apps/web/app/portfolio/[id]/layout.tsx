import type { Metadata } from 'next';
import type { ApiResponse } from '@czd/shared-types';
import type { PortfolioItemDto } from '@czd/shared-types';
import { API_URL } from '@/lib/api-url';
import { getServerTranslator } from '@/i18n/server';

// docs/portfolio-spec.md §13 — per-item title/description for the detail route, fetched
// server-side from the same public GET /api/portfolio/:id the client page also calls (no CV
// content here — this route carries none, per §5). Falls back to a generic title if the fetch
// fails so a broken/slow API never breaks the page itself, which still loads client-side.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getServerTranslator();
  try {
    const res = await fetch(`${API_URL}/api/portfolio/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error('not found');
    const body = (await res.json()) as ApiResponse<PortfolioItemDto>;
    const item = body.data;
    return {
      title: `${item.title} — ${t('nav.portfolio')} | CZ Digitizing`,
      description: item.description ?? t('portfolio.metaItemDescription', { category: item.category ?? t('services.embroideryDigitizing') }),
    };
  } catch {
    return { title: `${t('portfolio.metaItemTitle')} | CZ Digitizing` };
  }
}

export default function PortfolioDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
