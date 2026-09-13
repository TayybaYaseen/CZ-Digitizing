import * as React from 'react';

/** Pill switch with a gold active segment — Week/Month/Year on charts, Subscription Plans / Buy Credits on pricing. */
export interface SegmentedToggleProps extends React.HTMLAttributes<HTMLDivElement> {
  options: Array<string | { value: string; label: React.ReactNode }>;
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  tone?: 'light' | 'navy';
}
export function SegmentedToggle(props: SegmentedToggleProps): JSX.Element;
