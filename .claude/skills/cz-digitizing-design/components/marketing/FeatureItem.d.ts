import * as React from 'react';

/** Two-line trust item from the brand's feature strips: "10 Years / of Experience", "Fast Turnaround / Time". */
export interface FeatureItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'onNavy' | 'light';
}
export function FeatureItem(props: FeatureItemProps): JSX.Element;
