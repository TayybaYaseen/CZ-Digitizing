import * as React from 'react';

/** Single-choice control with a gold dot. */
export interface RadioProps extends React.HTMLAttributes<HTMLLabelElement> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}
export function Radio(props: RadioProps): JSX.Element;
