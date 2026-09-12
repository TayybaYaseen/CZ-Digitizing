import * as React from 'react';

/**
 * Service tile: embroidery photo, Playfair title, short description, gold "View Service →" link.
 * @startingPoint section="Marketing" subtitle="Service, pricing, credit-pack and testimonial cards" viewport="700x330"
 */
export interface ServiceCardProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** photo of the stitched result — always a real image, never an illustration */
  image?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  linkLabel?: string;
  tone?: 'light' | 'navy';
}
export function ServiceCard(props: ServiceCardProps): JSX.Element;
