import * as React from 'react';

/** Prepaid credit bundle tile from the pricing page's Buy Credits view. */
export interface CreditPackProps extends React.HTMLAttributes<HTMLDivElement> {
  credits: React.ReactNode;
  /** e.g. "25 Credits" */
  label?: React.ReactNode;
  price: React.ReactNode;
  /** per-credit note, e.g. "($1.40 per credit)" */
  unit?: React.ReactNode;
  featured?: boolean;
  flag?: string;
}
export function CreditPack(props: CreditPackProps): JSX.Element;
