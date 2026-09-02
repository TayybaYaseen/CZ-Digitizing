import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Exact brand-kit values from docs/CZ Digitizing Admin Panel.html (a Claude Design canvas
      // export) — supersedes the placeholder hex values docs/specs/2026-09-02-01-brand-visual-identity.md
      // §8 risk #2 flagged as "this spec's own concretization" pending a real reference. Full ramps
      // preserved (not just the 5 brand-kit core colors) since the admin panel design uses them
      // (e.g. navy-700 for the sidebar's raised/active surface, gold-100 for soft accent fills).
      colors: {
        brand: {
          navy: '#0B132B', // --cz-deep-navy
          // Compatibility aliases so existing components using brand.navyLight/brand.silver from
          // before this palette existed don't silently mis-render — navyLight now equals the same
          // "raised navy surface" role as --navy-700, silver approximates the old muted-on-navy text.
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
        status: {
          greenFg: '#16A34A',
          greenBg: '#DCFCE7',
          amberFg: '#D97706',
          amberBg: '#FEF3C7',
          redFg: '#DC2626',
          redBg: '#FEE2E2',
          blueFg: '#2563EB',
          blueBg: '#DBEAFE',
          violetFg: '#7C3AED',
          violetBg: '#EDE9FE',
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
