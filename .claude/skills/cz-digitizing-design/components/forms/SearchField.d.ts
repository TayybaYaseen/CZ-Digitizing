import * as React from 'react';

/** Input preset with a leading magnifier — every admin table and the site header use it. */
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  width?: number | string;
  size?: 'sm' | 'md';
}
export function SearchField(props: SearchFieldProps): JSX.Element;
