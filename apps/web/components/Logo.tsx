import Image from 'next/image';

// docs/specs/2026-09-02-01-brand-visual-identity.md AC-3 shipped a text-wordmark placeholder here
// because "no logo image asset has been supplied" (spec §1/§8) at the time. That's no longer true —
// the imported .claude/skills/cz-digitizing-design/assets/ now has the real mark (a moon-shaped C +
// silver crescent + metallic Z + gold needle/thread, per that skill's own readme.md) — copied into
// public/brand/ since Next.js can only serve static assets from an app's own public/ folder. `dark`/
// `horizontal-dark` both carry a baked-in navy card background (the kit's own "Dark version" lockup,
// not a transparent cutout) so they're for placement on this app's `bg-brand-navy` surfaces only;
// `light` is the one asset the kit supplied for a light/white background. There is no
// `light`+`horizontal` combination in the supplied assets, so `light` always renders the same image
// regardless of `layout`.
const SOURCES: Record<'dark' | 'light', Record<'stacked' | 'horizontal', string>> = {
  dark: { stacked: '/brand/logo-dark.png', horizontal: '/brand/logo-horizontal-dark.png' },
  light: { stacked: '/brand/logo-light.png', horizontal: '/brand/logo-light.png' },
};

const NATURAL_SIZE: Record<'dark' | 'light', Record<'stacked' | 'horizontal', { width: number; height: number }>> = {
  dark: { stacked: { width: 196, height: 164 }, horizontal: { width: 492, height: 92 } },
  light: { stacked: { width: 378, height: 232 }, horizontal: { width: 378, height: 232 } },
};

export function Logo({
  variant = 'dark',
  layout = 'stacked',
  height = 40,
}: {
  variant?: 'dark' | 'light';
  layout?: 'stacked' | 'horizontal';
  height?: number;
}) {
  const { width, height: naturalHeight } = NATURAL_SIZE[variant][layout];
  return (
    <Image
      src={SOURCES[variant][layout]}
      alt="CZ Digitizing"
      width={width}
      height={naturalHeight}
      style={{ height, width: 'auto' }}
      priority
    />
  );
}
