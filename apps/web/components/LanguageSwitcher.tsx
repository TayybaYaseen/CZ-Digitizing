'use client';

import { useState } from 'react';
import { useLocale } from '@/lib/locale-context';

// docs/specs/2026-08-28-16-internationalization.md AC-1 (aspect A-021, header entry for A-022).
export function LanguageSwitcher() {
  const { locale, languages, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  if (languages.length === 0) return null;
  const current = languages.find((l) => l.code === locale);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Select language"
        className="rounded-md border border-brand-silver/20 px-3 py-1.5 text-sm text-brand-silver hover:bg-white/5"
      >
        {current?.nativeName ?? locale.toUpperCase()}
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
