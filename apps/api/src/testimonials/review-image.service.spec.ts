import sharp from 'sharp';
import { ReviewImageService } from './review-image.service';

// docs/specs/2026-10-06-22-customer-review-submission.md §8 — the real sharp pipeline, with storage
// and Prisma faked.
function setup(referenceCount = 0) {
  const saved: { buffer?: Buffer; path?: string } = {};
  const storage = {
    hashContent: () => 'ab'.repeat(32),
    saveInNamespace: jest.fn(async (ns: string, buffer: Buffer, hash: string, ext: string) => {
      saved.buffer = buffer;
      saved.path = `/private/${ns}/${hash}.${ext}`;
      return saved.path;
    }),
    delete: jest.fn(async () => undefined),
    read: jest.fn(),
  };
  const prisma = { testimonial: { count: jest.fn(async () => referenceCount) } };
  return { service: new ReviewImageService(storage as never, prisma as never), storage, saved };
}

async function jpegWithGps(width = 3000, height = 1500): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#336699' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'PhoneCo', Model: 'X' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '24/1 51/1 0/1' } })
    .toBuffer();
}

describe('ReviewImageService.process', () => {
  it('re-encodes to WebP, caps the longest side at 2000px and strips all metadata (GPS included)', async () => {
    const { service, saved, storage } = setup();
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await service.process({ buffer: input, originalname: '../../evil"name.jpg' });

    expect(result.imageContentType).toBe('image/webp');
    expect(result.imageOriginalFilename).toBe('evilname.jpg');
    expect(storage.saveInNamespace).toHaveBeenCalledWith('review-images', expect.any(Buffer), expect.any(String), 'webp');
    const meta = await sharp(saved.buffer!).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(2000);
    expect(meta.exif).toBeUndefined();
  });

  it('rejects a renamed non-image (e.g. an executable) by magic bytes', async () => {
    const { service } = setup();
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]);
    await expect(service.process({ buffer: exe, originalname: 'photo.jpg' })).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
  });

  it('rejects SVG and GIF', async () => {
    const { service } = setup();
    await expect(service.process({ buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') })).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
    await expect(service.process({ buffer: Buffer.from('GIF89a' + '\0'.repeat(20)) })).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
  });

  it('rejects a truncated/corrupt JPEG as INVALID_IMAGE', async () => {
    const { service } = setup();
    const good = await jpegWithGps(400, 300);
    await expect(service.process({ buffer: good.subarray(0, 200) })).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('rejects files over 5MB', async () => {
    const { service } = setup();
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]);
    await expect(service.process({ buffer: big })).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});

describe('ReviewImageService.deleteIfUnreferenced', () => {
  it('deletes the file when no testimonial references it', async () => {
    const { service, storage } = setup(0);
    await service.deleteIfUnreferenced('/private/review-images/a.webp');
    expect(storage.delete).toHaveBeenCalledWith('/private/review-images/a.webp');
  });

  it('keeps the file while another testimonial still uses it', async () => {
    const { service, storage } = setup(1);
    await service.deleteIfUnreferenced('/private/review-images/a.webp');
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
