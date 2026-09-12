import * as React from 'react';

/**
 * Dashboard KPI tile: tinted icon chip, uppercase label, Playfair figure, delta line.
 * @startingPoint section="Admin" subtitle="KPI tiles, tables, activity and notification rows" viewport="700x200"
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** change line, e.g. "+12% this month" */
  delta?: React.ReactNode;
  deltaTone?: 'up' | 'down' | 'flat';
  icon?: string;
  /** icon-chip tint */
  tint?: 'green' | 'blue' | 'gold' | 'red' | 'violet' | 'navy';
  /** secondary line under the delta, e.g. "Needs attention" */
  note?: React.ReactNode;
}
export function StatCard(props: StatCardProps): JSX.Element;
