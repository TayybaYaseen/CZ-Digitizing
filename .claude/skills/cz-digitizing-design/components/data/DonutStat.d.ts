import * as React from 'react';

/** Donut share chart with an inline legend — the Top Categories block on Reports & Analytics. */
export interface DonutStatProps extends React.HTMLAttributes<HTMLDivElement> {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
}
export function DonutStat(props: DonutStatProps): JSX.Element;
