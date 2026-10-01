// docs/specs/2026-08-28-16-internationalization.md AC-7 — text arrows that mean "back"/"forward"
// must point the other way in RTL (Arabic/Urdu). Mirrors only the glyph, never the layout around it.
export function BackArrow() {
  return (
    <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
      ←
    </span>
  );
}

export function ForwardArrow() {
  return (
    <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
      →
    </span>
  );
}
