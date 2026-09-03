import Link from 'next/link';

// Mirrors apps/api/src/bundles/dto/bundle.dto.ts's BundleSummaryDto.
export interface BundleSummaryDto {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
  pricePkr: number;
  salePricePkr: number | null;
  isPublished: boolean;
}

// AC-1 — "same visual system as design cards" (DesignCard.tsx), simplified: no flip/dual-media/
// favorite, since bundles have neither.
export function BundleCard({ bundle }: { bundle: BundleSummaryDto }) {
  return (
    <Link
      href={`/bundles/${bundle.id}`}
      className="group flex h-72 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
    >
      {bundle.previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL, no next/image domain config
        <img src={bundle.previewImageUrl} alt={bundle.name} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-brand-lightGray" />
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-sm font-semibold text-brand-navy">{bundle.name}</p>
        {bundle.description && <p className="line-clamp-2 text-xs text-gray-500">{bundle.description}</p>}
        <div className="mt-auto flex items-center justify-between">
          <p className="text-sm">
            {bundle.salePricePkr ? (
              <>
                <span className="font-semibold text-brand-navy">Rs {bundle.salePricePkr}</span>{' '}
                <span className="text-xs text-gray-400 line-through">Rs {bundle.pricePkr}</span>
              </>
            ) : (
              <span className="font-semibold text-brand-navy">Rs {bundle.pricePkr}</span>
            )}
          </p>
          <span className="rounded-md bg-brand-gold px-2 py-1 text-xs font-semibold text-brand-navy">View Bundle</span>
        </div>
      </div>
    </Link>
  );
}
