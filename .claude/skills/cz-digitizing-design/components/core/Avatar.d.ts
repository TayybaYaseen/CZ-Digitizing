import * as React from 'react';

/** Round customer/admin avatar; falls back to navy-and-gold initials in Playfair. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  /** used for initials and alt text */
  name?: string;
  size?: number;
  shape?: 'circle' | 'rounded';
  /** gold outer ring */
  ring?: boolean;
}
export function Avatar(props: AvatarProps): JSX.Element;
