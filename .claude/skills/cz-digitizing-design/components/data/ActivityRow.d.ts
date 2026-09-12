import * as React from 'react';

/** One line in the Activity Log or Notifications list: tinted round icon, title, meta line, relative time. */
export interface ActivityRowProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: string;
  tint?: 'green' | 'blue' | 'gold' | 'red' | 'violet' | 'neutral';
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** right-aligned relative time, e.g. "2 min ago" */
  time?: React.ReactNode;
  divider?: boolean;
}
export function ActivityRow(props: ActivityRowProps): JSX.Element;
