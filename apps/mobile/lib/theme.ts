import { Platform } from 'react-native';

// Brand-kit tokens (docs/specs/2026-09-02-01-brand-visual-identity.md), kept in exact parity with
// apps/admin/tailwind.config.ts and apps/web/tailwind.config.ts's `brand`/`navy`/`gold` scales so
// all three surfaces render the same identity. No expo-font/@expo-google-fonts package is installed
// in this app yet, so `display` falls back to the same platform-serif stack the brand doc names as
// Playfair Display's own fallback ("Georgia, Times New Roman, serif") rather than silently guessing
// at a web font — swap this for a real Playfair Display face once that dependency is added.
export const colors = {
  navy900: '#060B1A',
  navy800: '#0B132B',
  navy700: '#111C3A',
  navy600: '#18264A',
  navy500: '#22335E',
  gold700: '#8A6D1E',
  gold600: '#B08F27',
  gold500: '#D4AF37',
  gold400: '#E0C25F',
  gold100: '#FAF1D8',
  gray900: '#1A202C',
  gray700: '#4A5568',
  gray600: '#718096',
  gray400: '#CBD5E0',
  gray300: '#E5E7EB',
  gray100: '#F4F6F9',
  white: '#FAFAFA',
} as const;

export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
} as const;

export const radius = { sm: 6, button: 8, card: 10, lg: 12, xl: 16, pill: 999 } as const;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;
