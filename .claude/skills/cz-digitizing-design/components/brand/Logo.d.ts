import * as React from 'react';

/**
 * The CZ Digitizing lockup. Always an image asset — never re-typeset the mark.
 * @startingPoint section="Brand" subtitle="Logo lockups: light, dark, mono, mark, app icon" viewport="700x180"
 */
export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** light = dark type on white, dark = light type on navy, mono = single-colour, primary = full lockup w/ tagline, mark = symbol only, appicon = rounded app tile */
  variant?: 'light' | 'dark' | 'mono' | 'primary' | 'mark' | 'appicon';
  /** rendered height in px; width follows the aspect ratio */
  height?: number;
  /** relative path to the design system's assets/ folder from the consuming page */
  assetBase?: string;
  alt?: string;
}
export function Logo(props: LogoProps): JSX.Element;
