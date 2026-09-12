import * as React from 'react';

/** Hairline gold divider — the brand's only decorative line. */
export interface GoldRuleProps extends React.HTMLAttributes<HTMLHRElement> {
  width?: number | string;
  thickness?: number;
  /** fade the rule out at both ends */
  fade?: boolean;
}
export function GoldRule(props: GoldRuleProps): JSX.Element;
