import * as React from 'react';

/** Artwork upload control — "Choose File / No file chosen", as on the quote form. */
export interface FileFieldProps extends React.HTMLAttributes<HTMLLabelElement> {
  buttonLabel?: string;
  /** current selection text shown beside the button */
  fileName?: string;
}
export function FileField(props: FileFieldProps): JSX.Element;
