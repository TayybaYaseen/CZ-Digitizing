import * as React from 'react';

export interface DataTableColumn {
  header: React.ReactNode;
  /** row property to read when no cell renderer is given */
  key?: string;
  /** custom renderer, e.g. for status badges and row actions */
  cell?: (row: any, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  strong?: boolean;
  wrap?: boolean;
}

/** The admin panel's list table: sunken uppercase header, hairline row rules, no zebra striping. */
export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  columns: DataTableColumn[];
  rows: any[];
  dense?: boolean;
}
export function DataTable(props: DataTableProps): JSX.Element;
