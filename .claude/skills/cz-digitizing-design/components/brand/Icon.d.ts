import * as React from 'react';

/** Outline icon (Lucide, CDN) tinted with currentColor. Substitute for the brand kit's gold line-icon set. */
export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon name, kebab-case, e.g. "shopping-cart" */
  name: string;
  size?: number;
  /** overrides currentColor */
  strokeColor?: string;
}
export function Icon(props: IconProps): JSX.Element;
