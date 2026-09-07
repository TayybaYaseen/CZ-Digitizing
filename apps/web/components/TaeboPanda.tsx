'use client';

import { useEffect, useState } from 'react';

// Taebo mascot artwork (docs/specs/2026-08-28-15-taebo-chatbot.md §1 "Taebo Helping Panda").
// A single transparent-background image, used uncropped in both the full-body mascot and the
// chat-header avatar — no separate head-crop asset, per explicit direction not to crop it
// differently per placement. `variant` only changes container sizing/shape, never the image
// framing itself.

interface TaeboPandaProps {
  variant?: 'full' | 'head';
  className?: string;
  waving?: boolean;
}

const SOURCE = '/images/taebo-full.png';

// Probed once per page load, shared across every TaeboPanda instance (the trigger button and the
// chat-header avatar both mount this component) so only one network request happens either way.
let probe: Promise<boolean> | null = null;
function probeImage(): Promise<boolean> {
  if (!probe) {
    probe = new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = SOURCE;
    });
  }
  return probe;
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

export function TaeboPanda({ variant = 'full', className = '', waving = false }: TaeboPandaProps) {
  // Never render the <img> tag until a plain client-side Image() probe has confirmed it actually
  // loads. Rendering the <img> directly (even with an onError handler) doesn't work here: this
  // component is server-rendered, so the browser starts fetching the src the instant the initial
  // HTML parses — for a fast local 404 that request resolves (and its non-bubbling `error` event
  // fires and is lost) before React finishes hydrating and attaches the onError listener, leaving
  // a permanently-broken image with no re-render ever triggered. Probing client-side in an effect
  // guarantees hydration has already happened before any request for this asset is made.
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    probeImage().then((loaded) => {
      if (!cancelled) setOk(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ok) {
    return <PandaFallback variant={variant} className={className} />;
  }

  if (variant === 'head') {
    // object-contain, not cover — shows the whole image inside the circle rather than cropping
    // into it, per direction to use the same uncropped picture everywhere.
    return (
      <span className={`flex items-center justify-center overflow-hidden rounded-full bg-brand-lightGray shadow-md ring-2 ring-white/80 ${waving ? 'taebo-idle-bob' : ''} ${className}`}>
        <img src={SOURCE} alt="Taebo the panda" className="h-full w-full object-contain" draggable={false} />
      </span>
    );
  }

  return (
    <img
      src={SOURCE}
      alt="Taebo the panda standing"
      className={`w-auto object-contain drop-shadow-2xl ${waving ? 'taebo-idle-bob' : ''} ${className}`}
      draggable={false}
    />
  );
}
