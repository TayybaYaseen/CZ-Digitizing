import type { Request, Response } from 'express';
import { GUEST_ORDERS_COOKIE, generateGuestAccessKey, hashGuestAccessKey, readGuestAccessKey, readGuestAccessKeyHash, setGuestAccessCookie } from './guest-access-key.util';

const req = (cookie: unknown) => ({ cookies: { [GUEST_ORDERS_COOKIE]: cookie } }) as unknown as Request;

describe('guest access key (guest checkout)', () => {
  it('mints a 256-bit base64url key, different every time', () => {
    const keys = new Set(Array.from({ length: 200 }, generateGuestAccessKey));
    expect(keys.size).toBe(200);
    for (const key of keys) {
      expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(key, 'base64url')).toHaveLength(32);
    }
  });

  it('stores only a SHA-256 hex digest, which is stable for the same key and never the key itself', () => {
    const key = generateGuestAccessKey();
    const hash = hashGuestAccessKey(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashGuestAccessKey(key));
    expect(hash).not.toContain(key);
    expect(hashGuestAccessKey(generateGuestAccessKey())).not.toBe(hash);
  });

  it('reads back only a well-formed key; anything else (missing, tampered, wrong length, not a string) is "no key"', () => {
    const key = generateGuestAccessKey();
    expect(readGuestAccessKey(req(key))).toBe(key);
    expect(readGuestAccessKeyHash(req(key))).toBe(hashGuestAccessKey(key));

    for (const bad of [undefined, '', '1', '42', key.slice(1), `${key}x`, `${key.slice(0, 42)}!`, "' OR 1=1 --", ['a'], 12345]) {
      expect(readGuestAccessKey(req(bad))).toBeNull();
      expect(readGuestAccessKeyHash(req(bad))).toBeNull();
    }
    expect(readGuestAccessKey({} as Request)).toBeNull();
  });

  it('sets an httpOnly, SameSite=Lax cookie that lasts ~13 months', () => {
    const cookie = jest.fn();
    setGuestAccessCookie({ cookie } as unknown as Response, 'k'.repeat(43));
    expect(cookie).toHaveBeenCalledWith(GUEST_ORDERS_COOKIE, 'k'.repeat(43), expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 400 * 24 * 60 * 60 * 1000 }));
  });
});
