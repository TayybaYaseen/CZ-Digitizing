import * as React from 'react';

/** Table pager: "Showing 1 to 8 of 892 orders" on the left, numbered pages with a gold current page on the right. */
export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  page?: number;
  pages?: number;
  onChange?: (page: number) => void;
  /** left-hand range summary text */
  summary?: React.ReactNode;
}
export function Pagination(props: PaginationProps): JSX.Element;
