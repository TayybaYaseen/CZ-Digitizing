import { ZipService } from './zip.service';

describe('ZipService (AC-3)', () => {
  const service = new ZipService();

  it('excludes .EMB from the delivery ZIP while preserving other formats with original names', () => {
    const files = [
      { fileFormat: 'DST', storagePath: '/x/a', originalName: 'Rose.dst' },
      { fileFormat: 'EMB', storagePath: '/x/b', originalName: 'Rose.emb' },
      { fileFormat: 'PES', storagePath: '/x/c', originalName: 'Rose.pes' },
    ];

    expect(service.includedNames(files)).toEqual(['Rose.dst', 'Rose.pes']);
  });

  it('excludes EMB regardless of case in the stored file_format value', () => {
    const files = [
      { fileFormat: 'emb', storagePath: '/x/a', originalName: 'Rose.emb' },
      { fileFormat: 'dst', storagePath: '/x/b', originalName: 'Rose.dst' },
    ];

    expect(service.includedNames(files)).toEqual(['Rose.dst']);
  });

  it('returns an empty list when every authorized file is EMB', () => {
    const files = [{ fileFormat: 'EMB', storagePath: '/x/a', originalName: 'Rose.emb' }];
    expect(service.includedNames(files)).toEqual([]);
  });

  it('preserves original filenames exactly, not the internal storage path', () => {
    const files = [{ fileFormat: 'DST', storagePath: '/private/ab/cd/deadbeef', originalName: 'My Custom Name.dst' }];
    expect(service.includedNames(files)).toEqual(['My Custom Name.dst']);
  });
});
