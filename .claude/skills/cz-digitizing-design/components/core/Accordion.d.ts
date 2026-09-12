import * as React from 'react';

/** Collapsible Q&A rows — the "Common Questions" block on the quote page. */
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  items: Array<{ q: React.ReactNode; a: React.ReactNode }>;
  /** index open on mount; -1 for all closed */
  defaultOpen?: number;
}
export function Accordion(props: AccordionProps): JSX.Element;
