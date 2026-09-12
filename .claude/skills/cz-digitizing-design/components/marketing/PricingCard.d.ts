import * as React from 'react';

/** Subscription plan card. The featured plan gets a gold border, gold price, gold CTA and a "Most Popular" ribbon. */
export interface PricingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: React.ReactNode;
  price: React.ReactNode;
  period?: string;
  /** one-line audience note, e.g. "Ideal for growing business" */
  blurb?: React.ReactNode;
  features?: React.ReactNode[];
  featured?: boolean;
  ribbon?: string;
  ctaLabel?: string;
}
export function PricingCard(props: PricingCardProps): JSX.Element;
