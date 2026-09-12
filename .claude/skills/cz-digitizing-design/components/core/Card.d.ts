import * as React from 'react';

/**
 * Surface container: white, 1px light-grey border, 10px radius, soft shadow.
 * @startingPoint section="Core" subtitle="Card surfaces in light, navy and gold tones" viewport="700x220"
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** optional Playfair heading in the card header */
  title?: React.ReactNode;
  /** right-aligned control in the header (toggle, link, icon button) */
  action?: React.ReactNode;
  tone?: 'light' | 'navy' | 'gold' | 'flat';
  padding?: string;
  bodyStyle?: React.CSSProperties;
  children?: React.ReactNode;
}
export function Card(props: CardProps): JSX.Element;
