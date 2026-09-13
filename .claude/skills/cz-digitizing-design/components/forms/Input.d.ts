import * as React from 'react';

/**
 * Single-line text field. 40px tall, 8px radius, hairline grey border going gold on focus.
 * @startingPoint section="Forms" subtitle="Text, search, select, file and choice controls" viewport="700x260"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Lucide icon name rendered inside the field, left-aligned */
  icon?: string;
  size?: 'sm' | 'md';
  invalid?: boolean;
}
export function Input(props: InputProps): JSX.Element;
