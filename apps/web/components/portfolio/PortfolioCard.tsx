import Link from 'next/link';
import type { PortfolioItemDto } from '@czd/shared-types';

// docs/portfolio-spec.md §5.11/§6/§7 — real, admin-managed work samples only. Mirrors
// DesignCard.tsx's front-face card treatment (rounded-card, shadow-cz-sm/md, gold border on
// hover, category pill) rather than inventing a new card language.
export function PortfolioCard({ item }: { item: PortfolioItemDto }) {
  const thumbnail = item.embroideryResultUrl || item.originalArtworkUrl || item.mediaUrls[0] || null;
  const alt = (thumbnail && item.mediaAltTexts[thumbnail]) || item.title;

  return (
    <Link
      href={`/portfolio/${item.id}`}
      className="group block overflow-hidden rounded-card border border-gray-200 bg-white shadow-cz-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-cz-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-lightGray">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-uploaded URL
          <img src={thumbnail} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
        )}
        {item.isFeatured && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-navy">
            Featured
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-brand-navy">{item.title}</p>
        {item.category && <span className="mt-1 inline-block rounded-full bg-brand-lightGray px-2 py-0.5 text-[10px] font-medium text-brand-navy">{item.category}</span>}
      </div>
    </Link>
  );
}
