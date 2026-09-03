import { Injectable } from '@nestjs/common';
import { PassThrough } from 'stream';

export interface ZipSourceFile {
  fileFormat: string;
  storagePath: string;
  // Original filename as it should appear inside the ZIP — never the internal storage path.
  originalName: string;
}

// docs/specs/2026-08-28-05-private-file-management.md AC-3 — "the .EMB file is excluded from the
// ZIP while all other authorized formats are preserved with their original names". A pure
// stream-building function over an already-authorized file list — no Orders dependency, so it's
// fully testable today even though the endpoint that calls it with real authorized files is
// gated on Orders (TODO(A-013)).
@Injectable()
export class ZipService {
  // archiver is an ESM-only package (jest/ts-jest can't load it via a static top-level import
  // without extra transform config) — imported dynamically here so it's only ever touched at
  // actual ZIP-build time, keeping this module (and includedNames() below) fully unit-testable
  // without a build-tooling workaround.
  async buildDeliveryZip(files: ZipSourceFile[]): Promise<NodeJS.ReadableStream> {
    const { ZipArchive } = await import('archiver');
    const included = files.filter((f) => f.fileFormat.toUpperCase() !== 'EMB');

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = new PassThrough();
    archive.pipe(output);

    for (const file of included) {
      archive.file(file.storagePath, { name: file.originalName });
    }

    archive.finalize();
    return output;
  }

  // Names that would actually be written into the ZIP, for unit testing without touching disk.
  includedNames(files: ZipSourceFile[]): string[] {
    return files.filter((f) => f.fileFormat.toUpperCase() !== 'EMB').map((f) => f.originalName);
  }
}
