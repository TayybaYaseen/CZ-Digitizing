import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { detectRasterImageType } from '../common/files/image-type.util';
import { ApiException } from '../common/exceptions/api-exception';
import { StorageService } from '../files/storage.service';
import { sanitizeOriginalFilename } from '../orders/receipt-file-type.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  REVIEW_IMAGE_MAX_BYTES,
  REVIEW_IMAGE_MAX_DIMENSION,
  REVIEW_IMAGE_MAX_INPUT_PIXELS,
  REVIEW_IMAGE_NAMESPACE,
  REVIEW_IMAGE_WEBP_QUALITY,
} from './testimonials.constants';

export interface StoredReviewImage {
  imageStoragePath: string;
  imageContentType: string;
  imageOriginalFilename: string | null;
}

// docs/specs/2026-10-06-22-customer-review-submission.md §8 (aspect A-026). Pipeline for every review
// image, customer- or Admin-supplied:
//   1. size cap (multer enforces it too, this is the service-level guarantee);
//   2. magic-byte allow-list (JPEG/PNG/WebP) — the client MIME type and extension are ignored;
//   3. sharp decode with a pixel cap (rejects corrupt files and decompression bombs);
//   4. EXIF auto-rotate, resize to ≤ 2000 px, re-encode to WebP — which drops ALL metadata (GPS
//      location from phone photos included) and any payload smuggled after/inside the original;
//   5. private, content-addressed storage under its own namespace (never the public /uploads root).
@Injectable()
export class ReviewImageService {
  private readonly logger = new Logger(ReviewImageService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async process(file: { buffer: Buffer; originalname?: string }): Promise<StoredReviewImage> {
    if (file.buffer.length > REVIEW_IMAGE_MAX_BYTES) throw new ApiException('FILE_TOO_LARGE', 413, 'Image exceeds the 5MB limit');
    if (!detectRasterImageType(file.buffer)) {
      throw new ApiException('UNSUPPORTED_FILE_TYPE', 415, 'Review photos must be a JPEG, PNG or WebP image');
    }

    let output: Buffer;
    try {
      output = await sharp(file.buffer, { limitInputPixels: REVIEW_IMAGE_MAX_INPUT_PIXELS, failOn: 'error' })
        .rotate()
        .resize({ width: REVIEW_IMAGE_MAX_DIMENSION, height: REVIEW_IMAGE_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: REVIEW_IMAGE_WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new ApiException('INVALID_IMAGE', 422, 'The image could not be read — it may be damaged or too large');
    }

    const hash = this.storage.hashContent(output);
    const imageStoragePath = await this.storage.saveInNamespace(REVIEW_IMAGE_NAMESPACE, output, hash, 'webp');
    return { imageStoragePath, imageContentType: 'image/webp', imageOriginalFilename: sanitizeOriginalFilename(file.originalname) };
  }

  read(storagePath: string): Promise<Buffer> {
    return this.storage.read(storagePath);
  }

  // §12 — content-addressed paths can be shared (two identical photos), so a file is removed only
  // once no testimonial row references it any more. Call AFTER the row change is committed.
  async deleteIfUnreferenced(storagePath: string | null | undefined): Promise<void> {
    if (!storagePath) return;
    const stillUsed = await this.prisma.testimonial.count({ where: { imageStoragePath: storagePath } });
    if (stillUsed > 0) return;
    try {
      await this.storage.delete(storagePath);
    } catch (err) {
      // A leftover private file is harmless (never served without a row); don't fail the request.
      this.logger.warn(`Could not delete review image ${storagePath}: ${(err as Error).message}`);
    }
  }
}
