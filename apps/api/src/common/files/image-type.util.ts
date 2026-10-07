// Raster image type detection by the file's own leading bytes ("magic bytes"), never by the
// client-declared MIME type or filename extension (both trivially spoofed). Shared by A-013 bank
// receipts and A-026 customer review images (docs/specs/2026-10-06-22-customer-review-submission.md §8).
// Only JPEG/PNG/WebP — GIF, SVG (can carry script), HEIC, HTML, archives and executables all return null.

export type RasterImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export function detectRasterImageType(buffer: Buffer): RasterImageContentType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';

  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';

  return null;
}
