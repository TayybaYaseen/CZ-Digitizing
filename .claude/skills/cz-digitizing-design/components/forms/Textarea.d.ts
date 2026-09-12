import * as React from 'react';

/** Multi-line field for messages and special instructions. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  rows?: number;
}
export function Textarea(props: TextareaProps): JSX.Element;
