import * as React from 'react';

/**
 * The brand's action control. Gold primary, navy secondary, gold-outline tertiary.
 * @startingPoint section="Core" subtitle="Gold, navy, outline and on-navy buttons in three sizes" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'outlineNavy' | 'onNavy' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  /** Lucide icon name rendered before the label */
  icon?: string;
  /** Lucide icon name rendered after the label — the brand uses "arrow-right" on CTAs */
  iconAfter?: string;
  block?: boolean;
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
