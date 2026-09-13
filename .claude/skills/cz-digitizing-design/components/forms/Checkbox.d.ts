import * as React from 'react';

/** Square check control, gold when checked. Also the tick used in guarantee lists. */
export interface CheckboxProps extends React.HTMLAttributes<HTMLLabelElement> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  tone?: 'light' | 'navy';
  disabled?: boolean;
}
export function Checkbox(props: CheckboxProps): JSX.Element;
