import * as React from 'react';

/** Screen header: Playfair title, optional greeting line, controls on the right. */
export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  title?: React.ReactNode;
  /** greeting or context line, e.g. "Welcome back, Muhammad Suleman Yaseen" */
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  tone?: 'light' | 'navy';
}
export function TopBar(props: TopBarProps): JSX.Element;
