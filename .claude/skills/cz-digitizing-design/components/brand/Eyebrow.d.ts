import * as React from 'react';

/** Wide-tracked uppercase micro-label, the brand's signature label treatment (e.g. MACHINE EMBROIDERY DESIGN, MANAGE • TRACK • GROW). */
export interface EyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  tone?: 'gold' | 'muted' | 'onNavy';
  /** flank the label with hairline gold rules, as in the logo tagline */
  rules?: boolean;
}
export function Eyebrow(props: EyebrowProps): JSX.Element;
