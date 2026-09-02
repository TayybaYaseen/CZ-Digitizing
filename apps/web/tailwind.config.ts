import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // docs/specs/2026-09-02-01-brand-visual-identity.md §5 — concretizes the SRS's narrative
      // palette ("Deep Navy/Black, Silver, White, Light Gray, Gold Accent") into hex tokens shared
      // by both apps. Open for Admin review per that spec's §8 risk #2.
      colors: {
        brand: {
          navy: '#0B1220',
          navyLight: '#152238',
          gold: '#C9A227',
          silver: '#C4CBD4',
          lightGray: '#F4F5F7',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
