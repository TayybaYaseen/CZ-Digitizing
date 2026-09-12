import * as React from 'react';

/** Icon in a circular or rounded holder — the brand's feature-strip and service-icon treatment. */
export interface IconTileProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon name; ignored if children are given */
  icon?: string;
  size?: number;
  tone?: 'goldOutline' | 'goldSolid' | 'goldSoft' | 'navy' | 'onNavy';
  shape?: 'circle' | 'rounded';
  children?: React.ReactNode;
}
export function IconTile(props: IconTileProps): JSX.Element;
