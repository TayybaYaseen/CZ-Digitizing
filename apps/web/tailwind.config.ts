import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 400px step between Tailwind's default base and `sm` (640px) — used by the header's
      // responsive search-field width so it can shrink gracefully on small phones instead of
      // jumping straight from "full flex-1 width" to the 640px `sm` value.
      screens: {
        xs: '400px',
      },
      // Exact brand-kit values from docs/CZ Digitizing Admin Panel.html (a Claude Design canvas
      // export) — kept in parity with apps/admin/tailwind.config.ts's own palette (that config's own
      // comment explains these supersede the placeholder hex values docs/specs/2026-09-02-01-brand-
      // visual-identity.md §8 risk #2 originally flagged). This app's config had never been updated
      // to match once admin's was, so every brand-navy/brand-gold/font-display class already used
      // across apps/web's components was silently rendering the old placeholder colors and no
      // Playfair Display at all (see app/layout.tsx's own fix in this same change).
      colors: {
        brand: {
          navy: '#0B132B', // --cz-deep-navy
          navyLight: '#111C3A',
          silver: '#CBD5E0',
          slateBlue: '#4A5568', // --cz-slate-blue
          lightGray: '#E5E7EB', // --cz-light-gray
          gold: '#D4AF37', // --cz-gold
          white: '#FAFAFA', // --cz-white
        },
        navy: {
          900: '#060B1A',
          800: '#0B132B',
          700: '#111C3A',
          600: '#18264A',
          500: '#22335E',
          400: '#334A7A',
        },
        gold: {
          700: '#8A6D1E',
          600: '#B08F27',
          500: '#D4AF37',
          400: '#E0C25F',
          300: '#EDD892',
          100: '#FAF1D8',
        },
      },
      fontFamily: {
        // Brand kit: Playfair Display for headings, Montserrat for body — see design reference.
        display: ['var(--font-playfair)', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
        field: '8px',
      },
      boxShadow: {
        'cz-sm': '0 1px 3px rgba(11,19,43,.08), 0 1px 2px rgba(11,19,43,.04)',
        'cz-md': '0 4px 12px rgba(11,19,43,.08)',
        'cz-navy': '0 14px 34px rgba(11,19,43,.35)',
        'cz-gold': '0 6px 18px rgba(212,175,55,.30)',
      },
    },
  },
  plugins: [],
};

export default config;
