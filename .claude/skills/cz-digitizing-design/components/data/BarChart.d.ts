import * as React from 'react';

/** Flat column chart for the Sales Overview panel. Bars are gold; axis labels are faint micro-type. */
export interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
}
export function BarChart(props: BarChartProps): JSX.Element;
