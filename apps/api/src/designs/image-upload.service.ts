import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { ApiException } from '../common/exceptions/api-exception';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Admin's "Create design" flow only ever had a plain URL text field for previewImageUrl — no way
// to actually upload a local image file. This gives Admin a real upload step, storing under a
// PUBLIC (not the A-007 private embroidery) root so the resulting URL works directly in <img src>
// across the whole app, same way a design's previewImageUrl is used today.
@Injectable()
export class ImageUploadService implements OnModuleInit {
  private readonly root: string;
  private readonly publicUrlBase: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = config.get('STORAGE_PUBLIC_ROOT', { infer: true });
    this.publicUrlBase = `${config.get('API_BASE_URL', { infer: true })}/uploads`;
  }

  async onModuleInit(): Promise<void> {
    await mkdir(join(this.root, 'images'), { recursive: true });
  }

  async saveImage(file: { mimetype: string; buffer: Buffer; originalname: string }): Promise<{ url: string }> {
    const ext = ALLOWED_MIME_EXT[file.mimetype];
    if (!ext) {
      throw new ApiException('UNSUPPORTED_FILE_TYPE', 415, `"${file.mimetype}" is not a supported image type (JPEG/PNG/WebP/GIF only)`);
    }
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new ApiException('FILE_TOO_LARGE', 413, 'Image exceeds the 10MB limit');
    }

    // Content-addressed like the private storage service — a byte-identical re-upload reuses the
    // same file/URL instead of writing a duplicate.
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const filename = `${hash}${ext || extname(file.originalname)}`;
    const path = join(this.root, 'images', filename);
    await writeFile(path, file.buffer);

    return { url: `${this.publicUrlBase}/images/${filename}` };
  }
}
