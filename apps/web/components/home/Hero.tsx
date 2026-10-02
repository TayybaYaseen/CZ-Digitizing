'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { HeaderMediaDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useLocale } from '@/lib/locale-context';

// docs/specs/2026-09-01-20-landing-page-experience.md §5.1 — headline + primary CTA -> Get a Quote
// (AC-4, guest-accessible), secondary CTA -> All Designs. Always renders (AC-8 empty-state floor).
//
// Hero media (A-018c, docs/specs/2026-08-28-13-home-promotions-cms.md AC-6/AC-10/AC-11): the
// Admin's active Header Media items ARE the hero's visual layer. They used to render as a separate
// HeaderMediaBanner block stacked above this section, while the hero itself showed a hard-coded
// 354x110 brand-kit crop framed as a small bordered card on the right — two disconnected images,
// neither integrated into the hero. Now the media fills the hero's end side (full-bleed on mobile)
// with object-cover, and a navy gradient fades it into the hero background behind the text, so
// any image or video the Admin uploads gets the same treatment with no per-asset CSS. With no
// active media the hero falls back to its plain navy background.
//
// i18n (A-021): a client component so it switches language in the same render as the rest of the
// page (a server component only caught up after router.refresh() round-tripped, briefly showing
// the previous language). It is still server-rendered, in the cookie's language, on first load.
export function Hero() {
  const { t } = useLocale();
  const [items, setItems] = useState<HeaderMediaDto[]>([]);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    apiFetch<HeaderMediaDto[]>('/api/home/header-media?platform=desktop')
      .then((rows) => setItems(rows.filter((r) => r.imageUrl || r.videoUrl)))
      .catch(() => setItems([]));
  }, []);

  const current = items[index];

  // AC-11 — priority-ordered carousel, auto-advances per item's duration; manual navigation pauses.
  useEffect(() => {
    if (items.length < 2 || !current?.isCarouselItem || reducedMotion) return;
    const timer = setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % items.length);
    }, current.autoSlideDurationSeconds * 1000);
    return () => clearInterval(timer);
  }, [items, current, reducedMotion]);

  function goTo(i: number) {
    pausedRef.current = true; // manual navigation pauses auto-advance permanently for this visit
    setIndex(i);
  }

  const hasCaption = !!(current?.heading || current?.subheading || current?.ctaLink);

  return (
    <section className="relative isolate flex min-h-[460px] items-center overflow-hidden rounded-lg bg-brand-navy px-6 py-14 text-white sm:min-h-[500px] sm:px-10 sm:py-16 lg:min-h-[560px] lg:py-20">
      {items.length > 0 && (
        <div className="absolute inset-y-0 end-0 -z-10 w-full lg:w-[72%]" aria-hidden="true">
          {items.map((item, i) => (
            <HeroMediaLayer key={item.id} item={item} active={i === index} reducedMotion={reducedMotion} />
          ))}
          {/* Desktop: fades the media's start edge into the navy so there is no visible boundary. */}
          <div className="absolute inset-0 hidden bg-gradient-to-r from-brand-navy from-0% via-brand-navy/40 via-35% to-transparent to-70% rtl:bg-gradient-to-l lg:block" />
        </div>
      )}
      {items.length > 0 && (
        <>
          {/* Readability shade: strongest behind the text, transparent toward the media. */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-navy/60 via-brand-navy/70 to-brand-navy/90 lg:hidden" />
          <div className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-brand-navy/85 from-0% via-brand-navy/50 via-40% to-transparent to-75% rtl:bg-gradient-to-l lg:block" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-navy/70 via-transparent via-40% to-brand-navy/25" />
        </>
      )}

      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-start">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.26em] text-brand-gold">{t('home.hero.eyebrow')}</p>
          <div className="mx-auto mt-3 h-px w-12 bg-brand-gold lg:ms-0" />
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight drop-shadow-sm sm:text-5xl lg:text-[3.25rem]">
            {t('home.hero.titleLead')} <span className="text-brand-gold">{t('home.hero.titleAccent')}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-brand-silver sm:text-base lg:ms-0">
            {t('home.hero.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            {/* TODO(A-016): Smart Get a Quote form still Blocked — this CTA 404s until that aspect ships. */}
            <Link href="/get-a-quote" className="rounded-field bg-brand-gold px-6 py-3 text-sm font-semibold text-brand-navy shadow-cz-gold transition hover:brightness-110">
              {t('nav.getAQuote')}
            </Link>
            <Link href="/designs" className="rounded-field border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              {t('home.hero.browseAll')}
            </Link>
          </div>
        </div>

        {/* The Admin item's optional heading/subheading/CTA, as a caption over the media. */}
        {(hasCaption || items.length > 1) && (
          <div className="mx-auto mt-10 flex max-w-xs flex-col items-center gap-3 text-center lg:absolute lg:bottom-8 lg:end-10 lg:mt-0 lg:items-end lg:text-end">
            {current?.heading && <p dir="auto" className="font-display text-lg font-semibold drop-shadow">{current.heading}</p>}
            {current?.subheading && <p dir="auto" className="-mt-2 text-xs text-brand-silver drop-shadow">{current.subheading}</p>}
            {current?.ctaLink && (
              <a href={current.ctaLink} className="rounded-field bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/20">
                {t('common.learnMore')}
              </a>
            )}
            {items.length > 1 && (
              <div className="flex gap-1.5">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => goTo(i)}
                    aria-label={t('home.goToSlide', { number: i + 1 })}
                    className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-brand-gold' : 'w-1.5 bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// One Admin header-media item as a full-cover, decorative layer (the hero text carries the meaning). Items cross-fade; a video is only mounted
// while its slide is active so inactive slides don't download/play in the background. If autoplay
// is blocked (or the visitor prefers reduced motion) the video shows its first frame, or the item's
// image as poster when it has one — the hero never breaks.
function HeroMediaLayer({ item, active, reducedMotion }: { item: HeaderMediaDto; active: boolean; reducedMotion: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const useVideo = !!item.videoUrl && !(reducedMotion && item.imageUrl);

  useEffect(() => {
    if (!active || !useVideo || reducedMotion) return;
    videoRef.current?.play().catch(() => {});
  }, [active, useVideo, reducedMotion]);

  const mediaClass = `absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${active && loaded ? 'opacity-100' : 'opacity-0'}`;

  if (useVideo) {
    if (!active) return null;
    return (
      <video
        ref={videoRef}
        src={item.videoUrl!}
        poster={item.imageUrl ?? undefined}
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        onLoadedData={() => setLoaded(true)}
        className={mediaClass}
      />
    );
  }
  return (
    // Admin-uploaded URLs from any host, so a plain <img> rather than next/image's allow-listed loader.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.imageUrl!}
      alt=""
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      className={mediaClass}
    />
  );
}
