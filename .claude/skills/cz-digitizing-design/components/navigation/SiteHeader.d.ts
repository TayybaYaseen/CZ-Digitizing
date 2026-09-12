import * as React from 'react';

/**
 * The marketing site's navy header: dark logo lockup, nav with a gold active
 * underline, cart badge and account controls.
 * @startingPoint section="Marketing" subtitle="Navy site header with gold active nav" viewport="700x120"
 */
export interface SiteHeaderProps extends React.HTMLAttributes<HTMLElement> {
  links: Array<string | { value: string; label: React.ReactNode }>;
  active?: string;
  onNavigate?: (value: string) => void;
  assetBase?: string;
  /** language picker, search, account chip */
  right?: React.ReactNode;
  /** shows the cart glyph with a gold count bubble */
  cartCount?: number;
}
export function SiteHeader(props: SiteHeaderProps): JSX.Element;
