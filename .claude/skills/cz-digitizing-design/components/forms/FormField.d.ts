import * as React from 'react';

/** Label + control + hint/error wrapper. Required fields are marked with a gold asterisk. */
export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  /** replaces the hint and turns the message red */
  error?: React.ReactNode;
  htmlFor?: string;
  children?: React.ReactNode;
}
export function FormField(props: FormFieldProps): JSX.Element;
