import React from 'react';
import { Input } from './Input.jsx';

export function SearchField({ placeholder = 'Search…', width = 320, size = 'md', style, ...rest }) {
  return <div style={{ width, ...style }}><Input icon="search" placeholder={placeholder} size={size} {...rest} /></div>;
}
