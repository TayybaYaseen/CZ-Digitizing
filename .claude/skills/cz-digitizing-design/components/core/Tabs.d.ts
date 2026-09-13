import * as React from 'react';

/** Underlined tab bar with a 2px gold active rule — the customer-profile history tabs. */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Array<string | { value: string; label: React.ReactNode }>;
  value?: string;
  onChange?: (value: string) => void;
  tone?: 'light' | 'navy';
}
export function Tabs(props: TabsProps): JSX.Element;
