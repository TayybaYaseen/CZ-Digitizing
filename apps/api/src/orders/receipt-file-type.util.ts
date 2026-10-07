// A-013 (AC-4) — bank-transfer receipts are customer-supplied files that an Admin will open, so the
// type is decided by the file's own leading bytes ("magic bytes"), never by the client-declared
// MIME type or filename extension (both trivially spoofed). Only what a payment slip realistically
// is — JPEG/PNG/WebP screenshots and photos, or a PDF — is accepted; everything else (executables,
// HTML, SVG, archives, text) is refused by the caller with UNSUPPORTED_FILE_TYPE.

import { detectRasterImageType } from '../common/files/image-type.util';

export type ReceiptContentType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export function detectReceiptContentType(buffer: Buffer): ReceiptContentType | null {
  if (buffer.length < 12) return null;

  // JPEG/PNG/WebP detection is shared with A-026 review images.
  const image = detectRasterImageType(buffer);
  if (image) return image;

  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';

  return null;
}

const EXTENSION_BY_TYPE: Record<ReceiptContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function extensionForReceipt(contentType: ReceiptContentType): string {
  return EXTENSION_BY_TYPE[contentType];
}

// Control characters (0-31, 127) plus quotes and shell/header-hostile punctuation. Built from char
// codes so the source contains no raw control bytes.
const FORBIDDEN_FILENAME_CHARS = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "\"';<>|*?]",
  "g",
);

// The client-supplied name is only ever used for display — strip any path, control characters and
// quotes (it ends up in a Content-Disposition header), and bound the length.
export function sanitizeOriginalFilename(name: string | undefined): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(FORBIDDEN_FILENAME_CHARS, '').trim().slice(0, 120);
  return cleaned.length > 0 ? cleaned : null;
}
