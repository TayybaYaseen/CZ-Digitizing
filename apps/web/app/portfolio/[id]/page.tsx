'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ApiError, PortfolioItemDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { BackArrow } from '@/components/DirectionalArrow';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useLocale } from '@/lib/locale-context';
import { PortfolioLightbox, type LightboxImage } from '@/components/portfolio/PortfolioLightbox';
import { clientError } from '@/i18n/api-errors';

// docs/portfolio-spec.md §5's "Real Portfolio Work Samples" detail view — role-labeled images
// (original artwork / embroidery result / close-up / before-after), object-fit: contain in the
// lightbox so nothing is cropped when a customer inspects stitch quality (§9), and technical
// metadata (§10.1). Carries no CV/biography content — that lives only on /portfolio itself.
export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, formatNumber } = useLocale();
  const [item, setItem] = useState<PortfolioItemDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<PortfolioItemDto>(`/api/portfolio/${id}`)
      .then(setItem)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.loadPortfolioItemFailed')));
  }, [id]);

  const images = useMemo<LightboxImage[]>(() => {
    if (!item) return [];

    function roleImage(url: string | null, label: string): LightboxImage | null {
      if (!url) return null;
      return { url, label, alt: item!.mediaAltTexts[url] ?? `${item!.title} — ${label}` };
    }

    const roleImages = [
      roleImage(item.originalArtworkUrl, t('portfolio.roleOriginal')),
      roleImage(item.embroideryResultUrl, t('portfolio.roleResult')),
      roleImage(item.closeUpImageUrl, t('portfolio.roleCloseUp')),
      roleImage(item.beforeImageUrl, t('portfolio.roleBefore')),
      roleImage(item.afterImageUrl, t('portfolio.roleAfter')),
    ].filter((x): x is LightboxImage => x !== null);

    const galleryImages: LightboxImage[] = item.mediaUrls
      .filter((url) => !roleImages.some((r) => r.url === url))
      .map((url) => ({ url, alt: item.mediaAltTexts[url] ?? item.title }));

    return [...roleImages, ...galleryImages];
  }, [item, t]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!item) return <p className="text-center text-sm text-gray-500">{t('common.loading')}</p>;

  const metadata = [
    { label: t('portfolio.metaCategory'), value: item.category },
    { label: t('portfolio.metaSoftware'), value: item.softwareUsed.length ? item.softwareUsed.join(', ') : null },
    { label: t('portfolio.metaEmbroideryType'), value: item.embroideryType },
    { label: t('portfolio.metaStitchCount'), value: item.stitchCount != null ? formatNumber(item.stitchCount) : null },
    { label: t('portfolio.metaSize'), value: item.sizeLabel },
    { label: t('portfolio.metaMachineFormat'), value: item.machineFormat },
  ].filter((row) => row.value);

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <Link href="/portfolio" className="text-sm font-semibold text-brand-navy hover:text-gold-600">
        <BackArrow /> {t('portfolio.backToPortfolio')}
      </Link>

      <div>
        {item.category && <span className="rounded-full bg-brand-lightGray px-2.5 py-0.5 text-xs font-semibold text-brand-navy">{item.category}</span>}
        <h1 dir="auto" className="mt-2 font-display text-3xl font-bold text-brand-navy">{item.title}</h1>
        {item.description && <p dir="auto" className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-700 sm:text-base">{item.description}</p>}
      </div>

      {images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((image, i) => (
            <button
              // Index, not URL: the same image can legitimately serve more than one role (or
              // appear in both a role field and the gallery), which would otherwise collide.
              key={`${image.url}-${i}`}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative overflow-hidden rounded-card border border-gray-200 bg-brand-lightGray shadow-cz-sm transition hover:border-gold-500 hover:shadow-cz-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-uploaded URL */}
              <img src={image.url} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
              {image.label && (
                <span className="absolute bottom-2 start-2 rounded-full bg-brand-navy/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {image.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {metadata.length > 0 && (
        <div className="rounded-card border border-gray-200 bg-white p-5 shadow-cz-sm">
          <h2 className="font-display text-lg font-bold text-brand-navy">{t('portfolio.projectDetails')}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {metadata.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{row.label}</dt>
                <dd className="text-sm text-gray-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {openIndex !== null && (
        <PortfolioLightbox images={images} index={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />
      )}
    </article>
  );
}
