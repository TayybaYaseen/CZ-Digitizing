// Placeholder brand tokens for auth screens, matching the approved split-panel mockup.
// A-001 (Brand & Visual Identity System) is still "Not Started" in docs/specs/SPEC_INDEX.md —
// there is no canonical brand source yet. These constants exist so the auth screens don't hardcode
// magic values in three places; swap them out wholesale once A-001 ships real tokens.
export const brand = {
  name: 'CZ Digitizing',
  tagline: 'Your documents, organized and searchable.',
  description:
    'Sign in to manage scans, review digitized records, and track processing status across your team.',
  accent: '#4f46e5',
  accentHover: '#4338ca',
  accentRing: '#e0e7ff',
  panelBg: '#f8fafc',
} as const;
