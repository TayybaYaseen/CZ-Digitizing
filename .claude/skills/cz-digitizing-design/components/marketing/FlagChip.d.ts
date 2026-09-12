import * as React from 'react';

/**
 * Country flag + optional label. The one place the brand uses emoji: the
 * "Trusted by Businesses Worldwide" country row and the language picker.
 */
export interface FlagChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** two-letter ISO country code, e.g. "PK", "US", "DE" */
  flag: string;
  label?: React.ReactNode;
  size?: number;
}
export function FlagChip(props: FlagChipProps): JSX.Element;
