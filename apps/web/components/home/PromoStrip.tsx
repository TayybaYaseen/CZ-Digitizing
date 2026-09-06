'use client';

import { useEffect, useState } from 'react';
import type { AdvertisementDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';

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

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-3/AC-4/AC-5 — omitted entirely (no layout
// gap) when nothing is active; live countdown to endDate while one is.
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
  if (!countdown) return null; // endDate has passed client-side since the last fetch — disappear with no layout shift

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-brand-gold px-4 py-2 text-center text-sm font-semibold text-brand-navy">
      <span>{ad.heading}</span>
      {ad.offerText && <span className="font-normal">{ad.offerText}</span>}
      <span className="font-mono text-xs">
        {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s left
      </span>
      {ad.ctaLink && ad.ctaText && (
        <a href={ad.ctaLink} className="rounded-md bg-brand-navy px-2.5 py-1 text-xs text-white hover:brightness-110">
          {ad.ctaText}
        </a>
      )}
    </div>
  );
}
