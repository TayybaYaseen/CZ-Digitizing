import * as React from 'react';

/** Customer quote with a flag, name and country — the "What Our Customers Say" row. */
export interface TestimonialCardProps extends React.HTMLAttributes<HTMLElement> {
  quote: React.ReactNode;
  name: React.ReactNode;
  country?: React.ReactNode;
  /** ISO country code for the flag emoji, e.g. "US" */
  flag?: string;
}
export function TestimonialCard(props: TestimonialCardProps): JSX.Element;
