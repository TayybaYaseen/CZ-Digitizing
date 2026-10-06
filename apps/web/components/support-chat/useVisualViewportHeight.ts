'use client';

import { useEffect, useState } from 'react';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §23 — on phones the on-screen keyboard shrinks
// the *visual* viewport but not the layout viewport (iOS Safari especially), so a `100dvh` chat would
// hide its composer behind the keyboard. Tracking visualViewport.height keeps the composer directly
// above the keyboard.
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setHeight(Math.round(vv.height));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return height;
}
