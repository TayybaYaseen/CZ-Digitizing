import * as React from 'react';

/** Square icon-only control for toolbars, table row actions and the bell in the admin topbar. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  /** accessible label — required, the button has no visible text */
  label: string;
  size?: number;
  variant?: 'ghost' | 'outline' | 'gold' | 'onNavy';
  /** small red count bubble, e.g. unread notifications */
  badge?: number | string;
}
export function IconButton(props: IconButtonProps): JSX.Element;
