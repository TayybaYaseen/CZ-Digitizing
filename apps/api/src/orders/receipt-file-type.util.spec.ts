import { detectReceiptContentType, extensionForReceipt, sanitizeOriginalFilename } from './receipt-file-type.util';

const pad = (head: number[]) => Buffer.concat([Buffer.from(head), Buffer.alloc(32, 0x41)]);

describe('detectReceiptContentType (magic bytes, never the client-declared type)', () => {
  it('accepts JPEG, PNG, WebP and PDF', () => {
    expect(detectReceiptContentType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectReceiptContentType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectReceiptContentType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]))).toBe('image/webp');
    expect(detectReceiptContentType(Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)]))).toBe('application/pdf');
  });

  it('rejects executables, scripts, HTML/SVG, archives and plain text — whatever they are named', () => {
    const samples: Record<string, Buffer> = {
      exe: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(40)]),
      html: Buffer.from('<html><script>alert(1)</script></html>'),
      svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'),
      zip: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]),
      text: Buffer.from('this is definitely a bank receipt, trust me'),
      elf: Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(40)]),
    };
    for (const [name, buf] of Object.entries(samples)) expect([name, detectReceiptContentType(buf)]).toEqual([name, null]);
  });

  it('rejects empty and too-short buffers', () => {
    expect(detectReceiptContentType(Buffer.alloc(0))).toBeNull();
    expect(detectReceiptContentType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('a PNG-named payload that is really an executable is still rejected (extension is irrelevant)', () => {
    expect(detectReceiptContentType(Buffer.concat([Buffer.from('MZ'), Buffer.alloc(40)]))).toBeNull();
  });

  it('maps each type to an extension', () => {
    expect(extensionForReceipt('image/jpeg')).toBe('jpg');
    expect(extensionForReceipt('application/pdf')).toBe('pdf');
  });
});

describe('sanitizeOriginalFilename', () => {
  it('strips paths, control characters and header-breaking quotes', () => {
    expect(sanitizeOriginalFilename('C:\\Users\\me\\slip.png')).toBe('slip.png');
    expect(sanitizeOriginalFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeOriginalFilename('a"b\r\nc.pdf')).toBe('abc.pdf');
  });

  it('bounds the length and returns null when nothing usable remains', () => {
    expect(sanitizeOriginalFilename('x'.repeat(500))).toHaveLength(120);
    expect(sanitizeOriginalFilename('')).toBeNull();
    expect(sanitizeOriginalFilename(undefined)).toBeNull();
    expect(sanitizeOriginalFilename('///')).toBeNull();
  });
});
