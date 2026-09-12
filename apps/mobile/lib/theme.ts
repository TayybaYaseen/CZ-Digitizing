// Brand-kit tokens (docs/specs/2026-09-02-01-brand-visual-identity.md; the imported
// .claude/skills/cz-digitizing-design guidelines are the source of truth for the exact hex/type
// values below), kept in exact parity with apps/admin/tailwind.config.ts and
// apps/web/tailwind.config.ts's `brand`/`navy`/`gold` scales so all three surfaces render the same
// identity.
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

// Exact family-name parity with the `useFonts()` call in App.tsx, which loads these three faces via
// @expo-google-fonts — the weight is baked into which family you reference (there is no single
// "Playfair Display" family with a variable weight here), so these are the only three text styles
// this app should ever use: `display` for every heading/price/KPI figure (readme.md's own "Playfair
// Display for every heading... set bold" — there is deliberately no non-bold display weight),
// `body` for prose, and `bodyMedium` for "anything functional" (labels, buttons, nav) per the same
// doc. Do not pair these with a `fontWeight` style — RN can't synthesize a different weight for a
// custom static font registered under one family name, so `fontWeight` on these is a no-op at best
// and a faux-bold/skew on some platforms at worst.
export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  body: 'Montserrat_400Regular',
  bodyMedium: 'Montserrat_600SemiBold',
} as const;

export const radius = { sm: 6, button: 8, card: 10, lg: 12, xl: 16, pill: 999 } as const;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;
