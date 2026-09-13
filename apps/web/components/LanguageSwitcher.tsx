'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/lib/locale-context';

// docs/specs/2026-08-28-16-internationalization.md AC-1 (aspect A-021, header entry for A-022).
export function LanguageSwitcher() {
  const { locale, languages, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Mirrors Header.tsx's SearchBox click-outside pattern (aspect A-022).
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (languages.length === 0) return null;
  const current = languages.find((l) => l.code === locale);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Select language"
        className="flex-shrink-0 whitespace-nowrap rounded-field border border-brand-silver/20 px-1.5 py-1.5 text-[11px] text-brand-silver hover:bg-white/5 xs:px-2 xs:text-xs sm:px-3 sm:text-sm"
      >
        {/* Full native name from `sm` up; the 2-letter code alone below that so the header's
            right-hand cluster stays inside the viewport on small phones — same button, same
            click-to-open behavior, just a narrower label at small widths. */}
        <span className="sm:hidden">{locale.toUpperCase()}</span>
        <span className="hidden sm:inline">{current?.nativeName ?? locale.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-brand-silver/20 bg-brand-navyLight py-1 shadow-lg">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLocale(lang.code);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${lang.code === locale ? 'text-brand-gold' : 'text-brand-silver'}`}
            >
              {lang.nativeName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
