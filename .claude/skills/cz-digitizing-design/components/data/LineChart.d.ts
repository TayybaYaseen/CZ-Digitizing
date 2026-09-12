import * as React from 'react';

/** Single-series revenue line: gold stroke, faint gold wash beneath, hairline gridlines, no legend. */
export interface LineChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  /** formats the y-axis ticks, e.g. v => '$' + Math.round(v / 1000) + 'k' */
  valueFormat?: (value: number) => React.ReactNode;
  /** number of horizontal gridlines; keep it low (3–4) */
  gridLines?: number;
}
export function LineChart(props: LineChartProps): JSX.Element;
