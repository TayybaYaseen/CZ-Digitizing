Outline icon rendered from the Lucide CDN as a CSS mask, so it takes `color` from its parent.

```jsx
<Icon name="scissors" size={20} />
<span style={{color:'var(--gold-500)'}}><Icon name="home" /></span>
```

Icon names are Lucide kebab-case. Never hand-draw SVG glyphs for this brand.
