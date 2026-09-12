import * as React from 'react';

/** Pill label. Status tones match the admin panel's Paid / Pending / Rejected / Processing pills. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'gold' | 'goldSoft' | 'navy' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  icon?: string;
  /** leading round dot instead of an icon (the Active / Inactive customer pills) */
  dot?: boolean;
  size?: 'sm' | 'md';
  children?: React.ReactNode;
}
export function Badge(props: BadgeProps): JSX.Element;
