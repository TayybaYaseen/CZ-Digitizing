'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdvertisementDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useLocale } from '@/lib/locale-context';

function useCountdown(endDate: string) {
  const [remaining, setRemaining] = useState(() => new Date(endDate).getTime() - Date.now());

  useEffect(() => {
    const timer = setInterval(() => setRemaining(new Date(endDate).getTime() - Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  if (remaining <= 0) return null;
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-3/AC-4/AC-5 — the active advertisement, directly
// below the header (first thing in the home page, full-bleed). Omitted entirely (no layout gap) when
// nothing is active; live countdown to endDate while one is. The ad's banner image or video (AC-3
// "image/banner or video") renders as a full-width strip above the gold heading/countdown bar — it
// used to be fetched but never rendered, so an Admin-uploaded banner never reached the site.
export function PromoStrip() {
  const [ad, setAd] = useState<AdvertisementDto | null | undefined>(undefined);

  useEffect(() => {
    apiFetch<AdvertisementDto | null>('/api/home/advertisement')
      .then(setAd)
      .catch(() => setAd(null));
  }, []);

  if (!ad) return null; // covers both "still loading" (undefined) and "nothing active" (null) — no flash into an empty slot
  return <PromoStripContent ad={ad} />;
}

function PromoStripContent({ ad }: { ad: AdvertisementDto }) {
  const countdown = useCountdown(ad.endDate);
  const { t } = useLocale();
  if (!countdown) return null; // endDate has passed client-side since the last fetch — disappear with no layout shift

  return (
    <section>
      <AdMedia ad={ad} />
      <div className="flex flex-wrap items-center justify-center gap-3 bg-brand-gold px-4 py-2 text-center text-sm font-semibold text-brand-navy">
        <span dir="auto">{ad.heading}</span>
        {ad.offerText && <span dir="auto" className="font-normal">{ad.offerText}</span>}
        <span className="font-mono text-xs">
          {t('home.promoCountdown', { days: countdown.days, hours: countdown.hours, minutes: countdown.minutes, seconds: countdown.seconds })}
        </span>
        {ad.ctaLink && ad.ctaText && (
          <a href={ad.ctaLink} className="rounded-md bg-brand-navy px-2.5 py-1 text-xs text-white hover:brightness-110">
            {ad.ctaText}
          </a>
        )}
      </div>
    </section>
  );
}

// Full-width banner showing the WHOLE ad (ads carry text, so never cropped or stretched): the media
// keeps its own aspect ratio, capped in height; when that leaves room at the sides it's filled with
// a blurred, cover-scaled copy of the same image rather than empty bars. A video plays as a muted,
// looping, control-less banner with the image as its poster; if it fails to load it falls back to
// the image (or the media row disappears, leaving the gold bar), and if autoplay is blocked or the
// visitor prefers reduced motion the poster/first frame stays. Clicking it follows the CTA.
function AdMedia({ ad }: { ad: AdvertisementDto }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const useVideo = !!ad.bannerVideoUrl && !videoFailed && !(reducedMotion && ad.bannerImageUrl);

  useEffect(() => {
    if (useVideo && !reducedMotion) videoRef.current?.play().catch(() => {});
  }, [useVideo, reducedMotion]);

  const mediaClass = 'relative mx-auto block h-auto max-h-[18rem] w-auto max-w-full sm:max-h-[24rem] lg:max-h-[min(36rem,70vh)]';
  let media: React.ReactNode = null;
  if (useVideo) {
    media = (
      <video
        ref={videoRef}
        src={ad.bannerVideoUrl!}
        poster={ad.bannerImageUrl ?? undefined}
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        onError={() => setVideoFailed(true)}
        className={mediaClass}
      />
    );
  } else if (ad.bannerImageUrl && !imageFailed) {
    // Admin-uploaded URLs from any host, so a plain <img> rather than next/image's allow-listed loader.
    // eslint-disable-next-line @next/next/no-img-element
    media = <img src={ad.bannerImageUrl} alt={ad.heading} onError={() => setImageFailed(true)} className={mediaClass} />;
  }
  if (!media) return null;

  return (
    <div className="relative overflow-hidden bg-brand-navy">
      {ad.bannerImageUrl && !imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.bannerImageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
      )}
      {ad.ctaLink ? (
        <a href={ad.ctaLink} aria-label={ad.ctaText || ad.heading} className="block">
          {media}
        </a>
      ) : (
        media
      )}
    </div>
  );
}
