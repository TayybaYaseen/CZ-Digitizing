import * as React from 'react';

export type SidebarNavItem =
  /** a navigable row */
  | { value: string; label: React.ReactNode; icon: string }
  /** a group heading — wide-tracked uppercase micro-label, no interaction */
  | { section: string };

/**
 * The admin panel's navy sidebar. The active item is a solid gold pill with navy text.
 * Items may be split into groups by interleaving `{ section: 'MAIN' }` entries.
 * @startingPoint section="Admin" subtitle="Navy sidebar and light admin topbar" viewport="700x340"
 */
export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: SidebarNavItem[];
  value?: string;
  onChange?: (value: string) => void;
  /** logo lockup + user chip block above the items */
  header?: React.ReactNode;
  /** logout row or version note pinned to the bottom */
  footer?: React.ReactNode;
  width?: number | string;
}
export function SidebarNav(props: SidebarNavProps): JSX.Element;
