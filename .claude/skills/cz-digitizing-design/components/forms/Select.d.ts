import * as React from 'react';

/** Dropdown with a chevron affordance; same geometry as Input. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<string | { value: string; label: React.ReactNode }>;
  size?: 'sm' | 'md';
  /** empty leading option, e.g. "Choose a service" */
  placeholder?: string;
}
export function Select(props: SelectProps): JSX.Element;
