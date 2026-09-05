'use client';

import { useEffect, useRef, useState } from 'react';
import type { HeaderMediaDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-6/AC-10/AC-11 — priority-ordered carousel,
// auto-advances per each item's configured duration, manual interaction pauses auto-advance (same
// posture as the Catalog spec's AC-5 design-card auto-swap), and respects prefers-reduced-motion
// (Landing Page Experience spec AC-10). Renders nothing when no header media is active.
export function HeaderMediaBanner() {
  const [items, setItems] = useState<HeaderMediaDto[]>([]);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    apiFetch<HeaderMediaDto[]>('/api/home/header-media?platform=desktop').then(setItems).catch(() => setItems([]));
  }, []);

  const current = items[index];

  useEffect(() => {
    if (items.length < 2 || !current?.isCarouselItem) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % items.length);
    }, current.autoSlideDurationSeconds * 1000);
    return () => clearInterval(timer);
  }, [items, current]);

  if (!current) return null;

  function goTo(i: number) {
    pausedRef.current = true; // manual navigation pauses auto-advance permanently for this visit
    setIndex(i);
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-brand-navy">
      {current.videoUrl ? (
        <video src={current.videoUrl} autoPlay muted loop playsInline className="h-56 w-full object-cover sm:h-72" />
      ) : current.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.imageUrl} alt={current.heading ?? ''} className="h-56 w-full object-cover sm:h-72" />
      ) : null}
      {(current.heading || current.subheading) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 px-4 text-center text-white">
          {current.heading && <h2 className="font-display text-2xl font-bold">{current.heading}</h2>}
          {current.subheading && <p className="mt-1 text-sm">{current.subheading}</p>}
          {current.ctaLink && (
            <a href={current.ctaLink} className="mt-3 rounded-md bg-brand-gold px-4 py-2 text-xs font-semibold text-brand-navy hover:brightness-110">
              Learn more
            </a>
          )}
        </div>
      )}
      {items.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-brand-gold' : 'bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
