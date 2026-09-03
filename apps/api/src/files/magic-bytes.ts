// docs/specs/2026-08-28-05-private-file-management.md §8 risk #1 — "extension-only .EMB detection
// can be bypassed by renaming; content_validated (magic-byte check) closes this but needs a
// concrete per-format signature table." This is that table, deliberately partial: only formats
// with a simple, reliably-documented header prefix are covered. A format absent here (JEF, EXP,
// VP3, EMB) is NOT content-validated — contentValidated stays false and the gap is real, not
// hidden. Extending this table is tracked as a follow-up, not claimed as done.
const SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  // Brother/Babylock/Bernina PES container header, e.g. "#PES0060".
  PES: (buf) => buf.subarray(0, 4).toString('ascii') === '#PES',
  // Tajima DST's fixed 512-byte header begins with a "LA:" (design label) field.
  DST: (buf) => buf.subarray(0, 3).toString('ascii') === 'LA:',
};

export function checkMagicBytes(extension: string, buffer: Buffer): boolean | null {
  const check = SIGNATURES[extension.toUpperCase()];
  if (!check) return null; // no known signature for this format — caller must not claim validation
  return check(buffer);
}
