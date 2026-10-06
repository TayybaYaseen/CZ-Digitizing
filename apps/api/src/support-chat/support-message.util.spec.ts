import { normalizeSupportMessageBody, supportMessagePreview } from './support-message.util';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §28.4 / §9.2.
describe('normalizeSupportMessageBody', () => {
  it('trims and keeps inner newlines and tabs', () => {
    expect(normalizeSupportMessageBody('  hello\n\tworld  ')).toEqual({ ok: true, body: 'hello\n\tworld' });
  });

  it('converts CRLF/CR to LF and strips other control characters', () => {
    expect(normalizeSupportMessageBody('a\r\nb\rc\u0000d\u0007e\u009Ff')).toEqual({ ok: true, body: 'a\nb\ncdef' });
  });

  it('collapses more than two blank lines into two', () => {
    expect(normalizeSupportMessageBody('a\n\n\n\n\n\nb')).toEqual({ ok: true, body: 'a\n\n\nb' });
  });

  it('keeps HTML as literal text (nothing is interpreted)', () => {
    expect(normalizeSupportMessageBody('<script>alert(1)</script>')).toEqual({ ok: true, body: '<script>alert(1)</script>' });
  });

  it('rejects whitespace-only and zero-width-only bodies', () => {
    expect(normalizeSupportMessageBody('   \n\t ')).toEqual({ ok: false, reason: 'empty' });
    expect(normalizeSupportMessageBody('​‍﻿')).toEqual({ ok: false, reason: 'empty' });
  });

  it('accepts exactly 4000 characters and rejects 4001 after normalization', () => {
    expect(normalizeSupportMessageBody('x'.repeat(4000)).ok).toBe(true);
    expect(normalizeSupportMessageBody('x'.repeat(4001))).toEqual({ ok: false, reason: 'too_long' });
    // Surrounding whitespace doesn't count — it's trimmed first.
    expect(normalizeSupportMessageBody(`  ${'x'.repeat(4000)}  `).ok).toBe(true);
  });

  it('NFC-normalizes so the same text is always stored the same way', () => {
    const decomposed = 'é'; // e + combining acute
    expect(normalizeSupportMessageBody(decomposed)).toEqual({ ok: true, body: 'é' });
  });

  it('keeps Urdu/Arabic text and emoji untouched', () => {
    expect(normalizeSupportMessageBody('میرا آرڈر کب تیار ہوگا؟ 👍')).toEqual({ ok: true, body: 'میرا آرڈر کب تیار ہوگا؟ 👍' });
  });
});

describe('supportMessagePreview', () => {
  it('flattens whitespace onto one line', () => {
    expect(supportMessagePreview('hello\n\n  there\tfriend')).toBe('hello there friend');
  });

  it('keeps short text as-is and caps long text at 140 characters including the ellipsis', () => {
    expect(supportMessagePreview('short')).toBe('short');
    const preview = supportMessagePreview('a'.repeat(300));
    expect(Array.from(preview)).toHaveLength(140);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('never cuts an emoji (surrogate pair) in half', () => {
    const preview = supportMessagePreview('😀'.repeat(200));
    expect(preview).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});
