'use client';

import { useEffect, useState } from 'react';

// Taebo mascot artwork (docs/specs/2026-08-28-15-taebo-chatbot.md §10 "Character & Interaction
// System"). ONE approved character, photographed/rendered as a realistic full-body panda in a
// navy vest with gold trim and a small CZ badge — never a cartoon/anime/chibi substitute (§10.1).
//
// `pose` selects which per-state asset to request (each mapped to the existing chatbot state
// machine in TaeboWidget.tsx — see §10.7's pose-mapping table); `variant` only changes container
// framing (full body vs. a circular head crop), never the character itself. Every pose asset is
// optional: if `taebo-<pose>.png` isn't present, this falls back to the master `taebo-full.png`
// (same character, no visible pose change) and finally to a 🐼 emoji if even that is missing — so
// the widget always renders something coherent while assets are still being supplied, per the
// design system's explicit rule against silently substituting a different-looking character.

export type TaeboPose = 'idle' | 'greeting' | 'thinking' | 'helping' | 'waiting' | 'success' | 'mobile';

interface TaeboPandaProps {
  variant?: 'full' | 'head';
  pose?: TaeboPose;
  className?: string;
  waving?: boolean;
}

const MASTER_SOURCE = '/images/taebo-full.png';

function poseSource(pose: TaeboPose): string {
  return `/images/taebo-${pose}.png`;
}

// Each candidate URL's probe result is cached and shared across every TaeboPanda instance mounted
// at once (launcher + chat-header avatar), so a given asset is only ever fetched once per page load
// regardless of how many places render that pose.
const probes = new Map<string, Promise<boolean>>();
function probeImage(src: string): Promise<boolean> {
  let probe = probes.get(src);
  if (!probe) {
    probe = new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
    probes.set(src, probe);
  }
  return probe;
}

// Resolves to the first source in the fallback chain that actually loads, or null if none do
// (master included) — null is the signal to show the emoji fallback.
async function resolveSource(pose: TaeboPose): Promise<string | null> {
  const candidates = pose === 'idle' ? [MASTER_SOURCE] : [poseSource(pose), MASTER_SOURCE];
  for (const candidate of candidates) {
    if (await probeImage(candidate)) return candidate;
  }
  return null;
}

function PandaFallback({ variant, className }: { variant: 'full' | 'head'; className: string }) {
  return (
    <span
      role="img"
      aria-label="Taebo the panda"
      className={`flex items-center justify-center bg-brand-lightGray ${variant === 'head' ? 'rounded-full' : 'rounded-2xl'} ${className}`}
      style={{ fontSize: variant === 'head' ? '1.5rem' : '4rem' }}
    >
      🐼
    </span>
  );
}

export function TaeboPanda({ variant = 'full', pose = 'idle', className = '', waving = false }: TaeboPandaProps) {
  // Never render the <img> tag until a plain client-side Image() probe has confirmed it actually
  // loads. Rendering the <img> directly (even with an onError handler) doesn't work here: this
  // component is server-rendered, so the browser starts fetching the src the instant the initial
  // HTML parses — for a fast local 404 that request resolves (and its non-bubbling `error` event
  // fires and is lost) before React finishes hydrating and attaches the onError listener, leaving
  // a permanently-broken image with no re-render ever triggered. Probing client-side in an effect
  // guarantees hydration has already happened before any request for this asset is made.
  const [resolved, setResolved] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    resolveSource(pose).then((src) => {
      if (!cancelled) setResolved(src);
    });
    return () => {
      cancelled = true;
    };
  }, [pose]);

  if (!resolved) {
    return <PandaFallback variant={variant} className={className} />;
  }

  if (variant === 'head') {
    // object-contain, not cover — shows the whole image inside the circle rather than cropping
    // into it, so a pose asset's framing is never chopped differently per placement.
    return (
      <span className={`flex items-center justify-center overflow-hidden rounded-full bg-brand-lightGray shadow-md ring-2 ring-white/80 ${waving ? 'taebo-idle-bob' : ''} ${className}`}>
        <img src={resolved} alt="Taebo the panda" className="h-full w-full object-contain" draggable={false} />
      </span>
    );
  }

  return (
    <img
      src={resolved}
      alt="Taebo the panda standing"
      className={`w-auto object-contain drop-shadow-2xl ${waving ? 'taebo-idle-bob' : ''} ${className}`}
      draggable={false}
    />
  );
}
