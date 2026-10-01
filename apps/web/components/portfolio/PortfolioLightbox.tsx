'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from '@/lib/locale-context';

export interface LightboxImage {
  url: string;
  alt: string;
  label?: string;
}

// docs/portfolio-spec.md §5.11/§6/§14 — no lightbox/modal component existed anywhere in apps/web
// before this (verified against the rest of the codebase); this follows the closest existing
// precedent for dismissable overlay UI (Header.tsx's SearchBox/LanguageSwitcher: Escape +
// click-outside dismissal) plus real keyboard navigation and focus handling, since a lightbox
// needs both. object-fit: contain here (not cover) per §9 — nothing is cropped in detail view.
export function PortfolioLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { t, dir } = useLocale();
  const current = images[index];

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      // RTL: the "next" image sits to the left, so the arrow keys swap meaning with the layout.
      else if (e.key === (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) onNavigate((index + 1) % images.length);
      else if (e.key === (dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) onNavigate((index - 1 + images.length) % images.length);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, images.length, onClose, onNavigate, dir]);

  if (!current) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.label ?? current.alt}
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/90 p-4 outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
      >
        ×
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={() => onNavigate((index - 1 + images.length) % images.length)}
          aria-label={t('portfolio.previousImage')}
          className="absolute start-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:start-4"
        >
          <span className="inline-block rtl:-scale-x-100">‹</span>
        </button>
      )}

      <figure className="flex max-h-full max-w-full flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-uploaded URL */}
        <img src={current.url} alt={current.alt} className="max-h-[80vh] max-w-full rounded-card object-contain" />
        {current.label && <figcaption className="mt-3 text-sm font-semibold text-white">{current.label}</figcaption>}
      </figure>

      {images.length > 1 && (
        <button
          type="button"
          onClick={() => onNavigate((index + 1) % images.length)}
          aria-label={t('portfolio.nextImage')}
          className="absolute end-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:end-4"
        >
          <span className="inline-block rtl:-scale-x-100">›</span>
        </button>
      )}
    </div>
  );
}
